pip install xmpppy

xmpp-message --debug \
    --jabberid art@selfdev-prosody.dev.local --password 123 \
    --receiver alice@selfdev-prosody.dev.local --message 'hello world'
