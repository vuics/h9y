#!/bin/bash

# # Start virtual display
Xvfb $DISPLAY -screen 0 $SCREEN_DIMENSIONS &
sleep $SLEEP_SEC

# Add window manager to make windows resizable
# fluxbox &
# openbox &
startxfce4 &
# xfce4-session &
# dbus-launch startxfce4 &
sleep $SLEEP_SEC

# Start VNC server
x11vnc -forever -shared -display $DISPLAY -rfbport $VNC_PORT &

sleep $SLEEP_SEC

# Start noVNC
/usr/share/novnc/utils/novnc_proxy --vnc localhost:$VNC_PORT --listen $NOVNC_PORT &

echo "Wait $SLEEP_SEC seconds for the display to be ready..."
sleep $SLEEP_SEC

echo "Run playwright codegen:"
echo "  DISPLAY=$DISPLAY playwright codegen --viewport-size=$VIEWPORT_SIZE --output=$OUTPUT_FILE --target=python-async $OPEN_URL &"
DISPLAY=$DISPLAY playwright codegen --viewport-size=$VIEWPORT_SIZE --output=$OUTPUT_FILE --target=python-async $OPEN_URL &

# echo "Run CUA Driver:"
# echo "  cua-driver serve"
# cua-driver serve &

# Run D-Bus session
# dbus-run-session -- cua-driver doctor

nodemon --exec python src/swarm_computeruse.py

sleep infinity

echo "END"

