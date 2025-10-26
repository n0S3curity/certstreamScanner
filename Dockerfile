FROM python:3.10

WORKDIR /app/backend


COPY cert_monitor.py .
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "cert_monitor.py"]

EXPOSE 5000