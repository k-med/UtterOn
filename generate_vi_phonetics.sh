#!/bin/bash

# Vietnamese Phonetics Audio Generator
# Generates audio for Consonants, Vowels, Digraphs/Trigraphs, and Tones modules
# Using "Mai" voice (mature Southern Vietnamese accent)

# Source the .env file
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found."
    exit 1
fi

# Output directory
OUTPUT_DIR="static/assets/audio/vietnamese"
mkdir -p "$OUTPUT_DIR"

# Mai voice (Middle-aged Southern Vietnamese)
VOICE_ID="2vT8WlUXV1qBtgiLZdSb"

echo "=========================================="
echo "Vietnamese Phonetics Audio Generator"
echo "Voice: Mai (Mature Southern Accent)"
echo "=========================================="

# Function to generate audio
generate_audio() {
    local id="$1"
    local text="$2"
    local output_file="$OUTPUT_DIR/${id}.mp3"
    
    echo "Generating: $id - \"$text\""
    
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
             "text": "'"$text"'"
         }' \
         --output "$output_file"
    
    if [ -f "$output_file" ] && [ -s "$output_file" ]; then
        echo "  ✓ Created: $output_file"
    else
        echo "  ✗ Failed: $output_file"
    fi
}

echo ""
echo "=== Consonants (15 items) ==="
generate_audio "vi_c001" "b"
generate_audio "vi_c002" "đ"
generate_audio "vi_c003" "d"
generate_audio "vi_c004" "g"
generate_audio "vi_c005" "h"
generate_audio "vi_c006" "k"
generate_audio "vi_c007" "l"
generate_audio "vi_c008" "m"
generate_audio "vi_c009" "n"
generate_audio "vi_c010" "p"
generate_audio "vi_c011" "r"
generate_audio "vi_c012" "s"
generate_audio "vi_c013" "t"
generate_audio "vi_c014" "v"
generate_audio "vi_c015" "x"

echo ""
echo "=== Vowels (12 items) ==="
generate_audio "vi_v001" "a"
generate_audio "vi_v002" "ă"
generate_audio "vi_v003" "â"
generate_audio "vi_v004" "e"
generate_audio "vi_v005" "ê"
generate_audio "vi_v006" "i"
generate_audio "vi_v007" "o"
generate_audio "vi_v008" "ô"
generate_audio "vi_v009" "ơ"
generate_audio "vi_v010" "u"
generate_audio "vi_v011" "ư"
generate_audio "vi_v012" "y"

echo ""
echo "=== Digraphs & Trigraphs (11 items) ==="
generate_audio "vi_dg001" "ch"
generate_audio "vi_dg002" "gh"
generate_audio "vi_dg003" "gi"
generate_audio "vi_dg004" "kh"
generate_audio "vi_dg005" "ng"
generate_audio "vi_dg006" "ngh"
generate_audio "vi_dg007" "nh"
generate_audio "vi_dg008" "ph"
generate_audio "vi_dg009" "qu"
generate_audio "vi_dg010" "th"
generate_audio "vi_dg011" "tr"

echo ""
echo "=== Tones (6 items) ==="
generate_audio "vi_tone001" "ma"
generate_audio "vi_tone002" "mà"
generate_audio "vi_tone003" "má"
generate_audio "vi_tone004" "mả"
generate_audio "vi_tone005" "mã"
generate_audio "vi_tone006" "mạ"

echo ""
echo "=========================================="
echo "Done! Generated 44 audio files."
echo "=========================================="
