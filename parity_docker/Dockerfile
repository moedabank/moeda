FROM ubuntu:14.04
WORKDIR /build

RUN apt-get update && apt-get install -y curl netcat-openbsd

RUN curl -Oparity_1.7.0_amd64.deb -L http://parity-downloads-mirror.parity.io/v1.7.0/x86_64-unknown-linux-gnu/parity_1.7.0_amd64.deb
RUN dpkg -i parity_1.7.0_amd64.deb
ADD devaccount.json /root/.local/share/io.parity.ethereum/keys/DevelopmentChain/UTC--2017-03-26T11-33-29Z--1e98bebd-5231-2167-c30a-db31a5b0499a
RUN bash -c 'for i in {1..3}; do /usr/bin/parity --chain dev account new --password <(echo ""); done'
ADD transfer.sh /root/transfer.sh
RUN bash /root/transfer.sh
ADD start.sh /root/start.sh

EXPOSE 8180 8945 8546
ENTRYPOINT ["bash", "/root/start.sh"]
