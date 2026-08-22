ARG PYTHON_IMAGE=python:3.13-slim
FROM ${PYTHON_IMAGE}

WORKDIR /app
COPY memory-service/src ./src
ENV PYTHONPATH=/app/src PYTHONUNBUFFERED=1
RUN useradd --create-home --uid 10002 aicp
USER aicp
EXPOSE 8080
CMD ["python", "-m", "aicp_memory.server"]
