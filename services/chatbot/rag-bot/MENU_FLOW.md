# Category-first navigation

The local UI shows the Taglish opening and all six configured categories before any user input. A fresh CLI chat does the same. A specific first question is answered directly, without an additional menu or forced selection. Menu selection, navigation, greetings, thanks and topic lists use no LLM or database calls.

## Editable knowledge-base menu

Edit menu_kb.json to add/rename categories or topics, translate names/examples/prompts, add aliases, change detail options, or adjust navigation phrases. It contains English and Tagalog text plus Taglish opening/interaction wording. The file is loaded on each turn, so data changes appear on the next menu without core-code changes. Numbering is generated from list order, including newly added categories. Common name misspellings use SequenceMatcher with a 0.80 threshold. Ambiguous short topic names narrow to category choices rather than becoming factual answers.

This JSON is navigation metadata, not evidence of a fee, official, service availability or policy. Selecting a topic queries the existing indexed document knowledge base. If documents do not support the requested detail, the reply says it is unavailable. Uploading a PDF/TXT does not automatically classify it into this taxonomy; edit the menu file to add its navigation entry.

## State and navigation

menu_flow.ChatState stores current_step (categories/topics/detail/answer), selected_category, selected_topic, selected_detail, language, cached last answer/sources and a bounded Back trail. State is per Streamlit session or per CLI loop, never a shared global conversation. Clear conversation resets it and shows the first greeting again.

- A category number, name or keyword opens only that category's topics and one question. Quick detail labels are displayed alongside the topic choices.
- A topic choice requests a short document-grounded overview. Detail labels such as Fee or Requirements resolve against the selected topic. If the topic is still unknown, the user chooses it first.
- Details/options opens the numbered detail choices. Steps/paano/how-to explicitly requests a guide; ordinary facts stay concise.
- Menu / Mga Paksa returns to categories. Back / Balik restores the previous displayed navigation state; cached answers keep their sources.
- Unknown input explains the scope and shows categories again.
- Numbers retain the selected language. Recognized Tagalog labels/commands switch to Tagalog; English labels/questions use English; mixed wording uses Taglish. Shared technical terms and numeric choices retain context where language is ambiguous. Language inference is deterministic and limited, not a general multilingual classifier.

## Reuse in the main app

```python
from menu_flow import ChatState, handle_message
from menu_chat import stream_menu_answer

state = ChatState()
decision = handle_message("1", state)
# For a menu decision, clients are not needed:
for event in stream_menu_answer(decision, state):
    if event.kind == "text":
        print(event.text)
# Only initialize Supabase/Ollama when decision.kind == "answer".
```

The UI/CLI use menu_flow + menu_chat. conversation.stream_conversation remains available for older free-conversation integrations, but is not the menu UI entry point. Short selections pass response_mode=concise to the same structured RAG generator, not a routing model. A numbered guide is requested only by an explicit step/how-to request. Related topics are capped at two. Responses finish with a localized Back to categories option. Typed names remain available even without clickable buttons.

## Validation

The automated suite covers first opening, category-only topics, topic lookups, first-question bypass, vague choices, fuzzy names, bilingual menus, Back/Menu from every step, unknown input, new categories without code edits, state reset and zero-call UI menus. The real CLI opening was tested with empty credentials and an unreachable Ollama endpoint, confirming offline navigation. A live first-turn Tagalog fee question returned the fictional test fee PHP 35 with a validated document source and one generation call; no menu or routing LLM was forced. Logs and detailed live results remain in ignored .private.

Limits: fuzzy/language matching may need additional aliases for regional wording. Menu metadata must be curated to stay aligned with your documents. Topic names are navigation options, never proof that factual details are available. Existing structural-order and semantic-grounding limits still apply. All current documents are test/sample material.

## Session-store integration

The menu engine remains the deterministic low-level router. UI and CLI now enter through session_chat.stream_session_message, which loads state from sessions.py and commits it after each turn. See SESSION_MEMORY.md for TTL, privacy-safe history and SQLite restart recovery. The presentation cache is not the authoritative selected-topic state.
