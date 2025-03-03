#!/bin/bash

# shell2http -host 0.0.0.0 -port 8387 -form /register 'prosodyctl register $v_user $v_host $v_password'

shell2http  -host 0.0.0.0 -port 8387 -form -cgi /register 'out=$(prosodyctl register $v_user $v_host $v_password 2>&1) ; [ $? -eq 0 ] && echo "Status: 200\n\nRegistration successfull" || echo "Status: 500\n\nRegistration failed"; echo "Command output:\n$out"'

