"""Strict generated-response schema and deterministic, language-neutral ordering."""
from typing import Annotated, Literal
import re
import unicodedata

from pydantic import BaseModel, ConfigDict, Field, model_validator

Text = Annotated[str, Field(min_length=1, max_length=2000)]


class StrictModel(BaseModel):
    model_config = ConfigDict(strict=True, extra='forbid')


class GuideStep(StrictModel):
    step_number: Annotated[int, Field(ge=1)]
    prerequisite: Annotated[str, Field(min_length=1, max_length=2000, description="null or 'Step N' referencing an EARLIER step action; an exact copy of that action is also accepted. Never reference the same or a future step.")] | None
    action: Annotated[str, Field(min_length=1, max_length=2000, description="The resident action in the user language, with a supporting passage citation such as [1].")]


class GeneratedResponse(StrictModel):
    kind: Literal['guide', 'answer', 'missing_information', 'refusal', 'topics']
    language: Literal['english', 'tagalog', 'taglish']
    overview: Annotated[str, Field(max_length=2000, description='Empty for concise answers. Otherwise every factual sentence MUST include an inline [passage number] marker, e.g. Documented fact [1].')]
    steps: Annotated[list[GuideStep], Field(max_length=30)]
    answer: Annotated[str, Field(max_length=6000, description='1-4 sentences in response_language. Every factual sentence MUST include [1], [2], etc. using the supplied passage number, even when source_ids is populated. For example: Documented fact [1]. Never write a Sources block.')]
    related_topics: Annotated[list[Text], Field(max_length=2, description='Up to two supported follow-up questions. Each must have an inline passage marker such as [1]. Otherwise return [].')]
    source_ids: Annotated[list[Text], Field(max_length=20, description='Exact source_id strings from context for all inline markers used. These IDs are different from passage numbers. They do not replace inline markers in the answer.')] = Field(default_factory=list)
    conflicts: Annotated[list[Annotated[list[Text], Field(min_length=2, max_length=5)]], Field(max_length=5)] = Field(default_factory=list)

    @model_validator(mode='after')
    def consistent_shape(self):
        if self.kind == 'guide' and not self.steps:
            raise ValueError('A numbered guide requires at least one structured step.')
        if self.kind != 'guide' and self.steps:
            raise ValueError('Only guides may contain steps.')
        if self.kind != 'guide' and re.search(r'(?m)^\s*\d+[.)]\s+', self.answer):
            raise ValueError('Numbered guides must use the steps array, not Markdown in answer.')
        if self.kind != 'guide' and not (self.answer.strip() or self.overview.strip() or self.related_topics):
            raise ValueError('A response cannot be blank.')
        if any(not topic.strip() for topic in self.related_topics):
            raise ValueError('Related topics cannot be whitespace.')
        if any(not step.action.strip() or (step.prerequisite is not None and not step.prerequisite.strip()) for step in self.steps):
            raise ValueError('Actions and non-null prerequisites cannot be whitespace.')
        return self


def canonical_action(text):
    """Literal references across languages, not semantic dependency inference."""
    text = re.sub(r'\[\d+\]', '', text)
    return ' '.join(unicodedata.normalize('NFKC', text).casefold().split())


def validate_guide(steps):
    """Return specific errors in O(n); never contacts a model or database.

    prerequisite is 'Step N'/'Hakbang N' or an earlier action copied verbatim (citations/spacing ignored).
    This checks the declared graph, not unexpressed real-world dependencies.
    """
    errors = []
    first_action = {}
    numbered_actions = {}
    for position, step in enumerate(steps, 1):
        first_action.setdefault(canonical_action(step.action), (position, step.step_number))
        numbered_actions.setdefault(step.step_number, (position, step.action))
        if step.step_number != position:
            errors.append(f'Expected step {position}, but found step {step.step_number}; step numbers must be sequential from 1 with no gaps or duplicates.')
    for position, step in enumerate(steps, 1):
        if step.prerequisite is None:
            continue
        reference = re.fullmatch(r'(?:step|hakbang)\s+(\d+)', canonical_action(step.prerequisite))
        requirement = step.prerequisite[:160]
        if reference:
            number = int(reference.group(1))
            target = numbered_actions.get(number)
            if target is None:
                errors.append(f'Step {step.step_number} requires Step {number}, which is not present in the guide.')
            elif target[0] >= position:
                errors.append(f'Step {step.step_number} requires "{target[1][:160]}", which first appears in step {number}. A prerequisite must be an EARLIER action.')
            continue
        match = first_action.get(canonical_action(step.prerequisite))
        if match is None:
            errors.append(f'Step {step.step_number} requires "{requirement}", which is not provided by any earlier action. Copy an earlier action exactly or include the missing prerequisite as a prior step.')
        elif match[0] >= position:
            errors.append(f'Step {step.step_number} requires "{requirement}", which first appears in step {match[1]}. A prerequisite must be satisfied by an EARLIER step, never the same or a later step.')
    return errors


CAUTION = {
    'english': "I couldn't fully verify the step order, so please double-check it.",
    'tagalog': 'Hindi ko lubos na natiyak ang pagkakasunod-sunod ng mga hakbang, kaya pakisuri ito.',
    'taglish': 'Hindi ko fully ma-verify ang step order, kaya paki-double-check ito.',
}

FRIENDLY_ERROR = {
    'english': "Sorry, I couldn't prepare a readable answer just now. Please try again or ask a shorter question.",
    'tagalog': 'Paumanhin po, hindi ko maihanda nang maayos ang sagot sa ngayon. Pakisubukan muli o paikliin ang tanong.',
    'taglish': 'Sorry po, hindi ko ma-prepare nang maayos ang answer ngayon. Paki-try ulit o gawing mas maikli ang question.',
}


def render_response(response, caution=False):
    parts = []
    if response.overview.strip():
        parts.append(response.overview.strip())
    if response.kind == 'guide':
        parts.append('\n'.join(f'{step.step_number}. {step.action.strip()}' for step in response.steps))
    if response.answer.strip() and canonical_action(response.answer) != canonical_action(response.overview):
        parts.append(response.answer.strip())
    if response.related_topics:
        heading = {'english': 'Related topics', 'tagalog': 'Mga kaugnay na paksa', 'taglish': 'Related topics'}[response.language]
        parts.append(heading + ':\n' + '\n'.join('- ' + topic.strip() for topic in response.related_topics))
    if caution:
        parts.append(CAUTION[response.language])
    return '\n\n'.join(parts)
