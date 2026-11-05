class ServiceError(Exception):
    """Domain error that is returned to the client with a clean message."""

    status_code = 400

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code


class NotFoundError(ServiceError):
    status_code = 404


class PipelineStateError(ServiceError):
    """Raised when a pipeline step is called before its prerequisite step has run."""

    status_code = 409
