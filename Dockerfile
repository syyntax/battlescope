FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app/ ./app/

# Create necessary directories
RUN mkdir -p uploads data

# Expose port 5000
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=app/app.py
ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["python", "app/app.py"]
