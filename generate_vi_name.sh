#!/bin/bash

# Vietnamese Name Audio Generator
# Generates "Tiếng Việt" audio with Southern accent

# Source the .env file
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found. Please create one with your API keys."
    exit 1
fi

# Output directory
OUTPUT_DIR="static/assets/audio/vietnamese"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="$OUTPUT_DIR/vi_name.mp3"
TEXT="Tiếng Việt"
# "Mai" - Middle-aged woman from Bien Hoa (Southern), professional tone
VOICE_ID="2vT8WlUXV1qBtgiLZdSb" 

echo "Generating Vietnamese native name audio..."
echo "Voice ID: $VOICE_ID (Mai - Mature Southern Accent)"
echo "Text: $TEXT"

curl --silent --request POST \
     --url "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID" \
     --header "Content-Type: application/json" \
     --header "xi-api-key: $API_KEY" \
     --data '{
         "voice_settings": {
             "stability": 0.5,
             "similarity_boost": 0.75,
             "style": 0,
             "use_speaker_boost": true
         },
         "model_id": "eleven_multilingual_v2",
         "text": "'"$TEXT"'"
     }' \
     --output "$OUTPUT_FILE"

if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    echo "  ✓ Created: $OUTPUT_FILE"
else
    echo "  ✗ Failed: $OUTPUT_FILE"
fi
