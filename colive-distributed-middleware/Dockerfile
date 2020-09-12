FROM python:alpine

WORKDIR /app

COPY ./colive_dist_mid colive_dist_mid
COPY ./requirements.txt requirements.txt

RUN true \
 && pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
 && pip install --no-cache-dir -r requirements.txt

EXPOSE 8000
ENTRYPOINT ["python", "-m", "colive_dist_mid"]
