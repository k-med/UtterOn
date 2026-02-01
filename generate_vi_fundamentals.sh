#!/bin/bash

# Vietnamese Fundamentals Audio Generator
# Generates audio for Numbers, Weekdays, Months, Time, Places, and Manners modules
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
echo "Vietnamese Fundamentals Audio Generator"
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
echo "=== Numbers (13 items) ==="
generate_audio "vi_n001" "Một"
generate_audio "vi_n002" "Hai"
generate_audio "vi_n003" "Ba"
generate_audio "vi_n004" "Bốn"
generate_audio "vi_n005" "Năm"
generate_audio "vi_n006" "Sáu"
generate_audio "vi_n007" "Bảy"
generate_audio "vi_n008" "Tám"
generate_audio "vi_n009" "Chín"
generate_audio "vi_n010" "Mười"
generate_audio "vi_n011" "Một trăm"
generate_audio "vi_n012" "Một nghìn"
generate_audio "vi_n013" "Một triệu"

echo ""
echo "=== Weekdays (7 items) ==="
generate_audio "vi_w001" "Thứ hai"
generate_audio "vi_w002" "Thứ ba"
generate_audio "vi_w003" "Thứ tư"
generate_audio "vi_w004" "Thứ năm"
generate_audio "vi_w005" "Thứ sáu"
generate_audio "vi_w006" "Thứ bảy"
generate_audio "vi_w007" "Chủ nhật"

echo ""
echo "=== Months (12 items) ==="
generate_audio "vi_mo001" "Tháng một"
generate_audio "vi_mo002" "Tháng hai"
generate_audio "vi_mo003" "Tháng ba"
generate_audio "vi_mo004" "Tháng tư"
generate_audio "vi_mo005" "Tháng năm"
generate_audio "vi_mo006" "Tháng sáu"
generate_audio "vi_mo007" "Tháng bảy"
generate_audio "vi_mo008" "Tháng tám"
generate_audio "vi_mo009" "Tháng chín"
generate_audio "vi_mo010" "Tháng mười"
generate_audio "vi_mo011" "Tháng mười một"
generate_audio "vi_mo012" "Tháng mười hai"

echo ""
echo "=== Time (6 items) ==="
generate_audio "vi_t001" "Giờ"
generate_audio "vi_t002" "Phút"
generate_audio "vi_t003" "Ngày"
generate_audio "vi_t004" "Tuần"
generate_audio "vi_t005" "Tháng"
generate_audio "vi_t006" "Năm"

echo ""
echo "=== Places (10 items) ==="
generate_audio "vi_p001" "Việt Nam"
generate_audio "vi_p002" "Hà Nội"
generate_audio "vi_p003" "Thành phố Hồ Chí Minh"
generate_audio "vi_p004" "Đà Nẵng"
generate_audio "vi_p005" "Hải Phòng"
generate_audio "vi_p006" "Cần Thơ"
generate_audio "vi_p007" "Huế"
generate_audio "vi_p008" "Nha Trang"
generate_audio "vi_p009" "Vũng Tàu"
generate_audio "vi_p010" "Đà Lạt"

echo ""
echo "=== Manners (13 items) ==="
generate_audio "vi_m001" "Cảm ơn."
generate_audio "vi_m002" "Cảm ơn nhiều."
generate_audio "vi_m003" "Làm ơn."
generate_audio "vi_m004" "Xin lỗi."
generate_audio "vi_m005" "Không sao."
generate_audio "vi_m006" "Không có gì."
generate_audio "vi_m007" "Dạ."
generate_audio "vi_m008" "Vâng."
generate_audio "vi_m009" "Không."
generate_audio "vi_m010" "Không, cảm ơn."
generate_audio "vi_m011" "Chào buổi sáng."
generate_audio "vi_m012" "Chào buổi tối."
generate_audio "vi_m013" "Chúc một ngày tốt lành."

echo ""
echo "=========================================="
echo "Done! Generated 61 audio files."
echo "=========================================="
