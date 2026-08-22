ARG PYTHON_IMAGE=python:3.13-slim@sha256:ffb752e139c0a19692a43af8d8523b274222dd68eebad5d583b45c2201c6e30a
FROM ${PYTHON_IMAGE}

WORKDIR /app
COPY memory-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --requirement requirements.txt
COPY memory-service/src ./src
ENV PYTHONPATH=/app/src PYTHONUNBUFFERED=1
RUN useradd --create-home --uid 10002 aicp
USER aicp
EXPOSE 8080
CMD ["python", "-m", "aicp_memory.server"]
