class PipelineFailure(Exception):
    """A technical failure, never evidence that a document lacks an answer."""
    def __init__(self, stage, code="unavailable", retryable=True):
        self.stage = stage
        self.code = code
        self.retryable = retryable
        super().__init__(f"{stage}: {code}")


class SourceChanged(PipelineFailure):
    def __init__(self):
        super().__init__("source_validation", "source_changed")
