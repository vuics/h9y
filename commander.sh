#!/bin/bash

# A command to test commander's /register:
#   curl -i http://selfdev-prosody.dev.local:8387/register\?user\=user1\&host\=localhost\&password\=12

# shell2http -host 0.0.0.0 -port 8387 -form /register 'prosodyctl register $v_user $v_host $v_password'

# shell2http -export-all-vars -host 0.0.0.0 -port 8387 -form -cgi /register 'out=$(prosodyctl register $v_user $v_host $v_password 2>&1) ; [ $? -eq 0 ] && echo "Status: 200\n\nRegistration successfull" || echo "Status: 500\n\nRegistration failed"; echo "Command: prosodyctl register $v_user $v_host $v_password 2>&1\n"; echo "Command output:\n$out";'

shell2http -export-all-vars -host 0.0.0.0 -port 8387 -form -cgi \
    /register-user 'out=$(prosodyctl register $v_user $v_host $v_password 2>&1) ; [ $? -eq 0 ] && echo "Status: 200\n\nRegistration successfull" || echo "Status: 500\n\nRegistration failed"; echo "Command: prosodyctl register $v_user $v_host $v_password 2>&1\n"; echo "Command output:\n$out";' \
    /register-agent 'out=$(prosodyctl shell "host:activate('\''$v_host'\'')" ; prosodyctl shell "user:create('\''$v_user@$v_host'\'', '\''$v_password'\'', '\'''\'')" 2>&1) ; [ $? -eq 0 ] && echo "Status: 200\n\nRegistration successfull" || echo "Status: 500\n\nRegistration failed"; echo "Command: prosodyctl register $v_user $v_host $v_password 2>&1\n"; echo "Command output:\n$out";'

