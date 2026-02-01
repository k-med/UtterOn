#!/bin/bash

# Vietnamese Audio Generator for UtterOn
# Generates audio files from the Social Lubricant module with slower speech for beginners

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

# Declare sentences array (id and text pairs)
declare -A sentences=(
    ["vi_sl001"]="Chào anh."
    ["vi_sl002"]="Chào chị."
    ["vi_sl003"]="Chào em."
    ["vi_sl004"]="Bạn có khỏe không?"
    ["vi_sl005"]="Tôi khỏe. Cảm ơn."
    ["vi_sl006"]="Tôi không khỏe."
    ["vi_sl007"]="Tôi mệt."
    ["vi_sl008"]="Tôi hơi buồn ngủ."
    ["vi_sl009"]="Còn bạn thì sao?"
    ["vi_sl010"]="Anh tên là gì?"
    ["vi_sl011"]="Tôi tên là Kade."
    ["vi_sl012"]="Anh là người nước nào?"
    ["vi_sl013"]="Tôi là người Úc."
    ["vi_sl014"]="Bạn bao nhiêu tuổi?"
    ["vi_sl015"]="Tôi ba mươi ba tuổi."
    ["vi_sl016"]="Số điện thoại của bạn là gì?"
    ["vi_sl017"]="Số điện thoại của tôi là 0976 895 345."
    ["vi_sl018"]="Rất vui được gặp anh."
    ["vi_sl019"]="Tạm biệt. Hẹn gặp lại."
)

echo "Generating Vietnamese audio files with slower speed for beginners..."
echo "Output directory: $OUTPUT_DIR"
echo ""

# Generate audio for each sentence
for id in "${!sentences[@]}"; do
    text="${sentences[$id]}"
    output_file="$OUTPUT_DIR/${id}.mp3"
    
    echo "Generating: $id - \"$text\""
    
    # Call ElevenLabs API with speed set to 0.85 for slower beginner-friendly pace
    curl --silent --request POST \
         --url "https://api.elevenlabs.io/v1/text-to-speech/$API_VOICE" \
         --header "Content-Type: application/json" \
         --header "xi-api-key: $API_KEY" \
         --data '{
             "voice_settings": {
                 "stability": 0.5,
                 "similarity_boost": 0.75,
                 "style": 0,
                 "use_speaker_boost": true,
                 "speed": 0.85
             },
             "model_id": "'"$API_MODEL_ID"'",
             "text": "'"$text"'"
         }' \
         --output "$output_file"
    
    if [ -f "$output_file" ] && [ -s "$output_file" ]; then
        echo "  ✓ Created: $output_file"
    else
        echo "  ✗ Failed: $output_file"
    fi
done

echo ""
echo "Done! Generated audio files in $OUTPUT_DIR"
