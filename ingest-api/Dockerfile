# ingest-api — Python 3.12 slim, non-root user
FROM python:3.12-slim

WORKDIR /app

# Create non-root user
RUN groupadd --gid 1000 app && \
    useradd --uid 1000 --gid app --shell /bin/bash --create-home app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY main.py config.py ./
COPY models/ ./models/
COPY routers/ ./routers/
COPY services/ ./services/
COPY utils/ ./utils/

RUN chown -R app:app /app

USER app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
