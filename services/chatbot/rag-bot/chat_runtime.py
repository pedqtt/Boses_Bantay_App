"""Private error/timing logs. Nothing propagates to a public UI or console."""
import logging
from logging.handlers import RotatingFileHandler
import re

import config


class RedactingFormatter(logging.Formatter):
    def format(self, record):
        value = super().format(record)
        if config.SUPABASE_SERVICE_ROLE_KEY:
            value = value.replace(config.SUPABASE_SERVICE_ROLE_KEY, '[REDACTED]')
        return value


def runtime_logger():
    logger = logging.getLogger('barangay_chat_runtime')
    if not logger.handlers:
        try:
            folder = config.ROOT / '.private'
            folder.mkdir(exist_ok=True)
            handler = RotatingFileHandler(folder / 'chat-runtime.log', maxBytes=1_000_000, backupCount=2, encoding='utf-8')
            handler.setFormatter(RedactingFormatter('%(asctime)s %(levelname)s %(message)s'))
        except OSError:
            handler = logging.NullHandler()
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


def fallback_language(question):
    """Best-effort language fallback only if routing itself is unavailable."""
    words = set(re.findall(r'\w+', question.casefold())) if isinstance(question, str) else set()
    tagalog = words & {'paano', 'magkano', 'ano', 'ang', 'mga', 'saan', 'salamat', 'kumusta', 'pakisubukan', 'po', 'ako', 'ng', 'ba', 'ito'}
    english = words & {'hello', 'help', 'please', 'what', 'how', 'guide', 'steps', 'requirements', 'upload', 'file', 'explain'}
    return 'taglish' if tagalog and english else 'tagalog' if tagalog else 'english'
