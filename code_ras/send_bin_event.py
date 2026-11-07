"""Send one camera frame from Raspberry Pi to Nhom4 API after a bin event.

Example:
  python send_bin_event.py --server http://192.168.1.10:3000 --mac-address AA:BB:CC:DD:EE:FF --image /tmp/bin-frame.jpg

Call this script from the existing sensor/camera loop whenever an object is detected.
With --classify, the image is sent to the Nhom4 backend AI Vision endpoint first, then
the image and returned label/category/confidence are recorded as a bin event.
This script does not capture the frame; --image must point to a photo already captured.
"""
import argparse
import base64
import json
import mimetypes
import pathlib
import urllib.error
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", required=True, help="Backend base URL, e.g. http://192.168.1.10:3000")
    parser.add_argument("--mac-address", default="PI-NHOM4-001", help="MAC address registered in TrashCans table (default PI-NHOM4-001)")
    parser.add_argument("--image", required=True, help="Path to captured JPEG/PNG frame")
    parser.add_argument("--label", default="Chưa nhận diện")
    parser.add_argument("--category", default="Chưa phân loại")
    parser.add_argument("--confidence", type=float, default=0)
    parser.add_argument("--fill-level", type=float, default=None)
    parser.add_argument("--classify", action="store_true", help="Ask backend AI Vision to classify the image before saving the event")
    args = parser.parse_args()

    image_path = pathlib.Path(args.image)
    if not image_path.is_file():
        parser.error(f"Không tìm thấy ảnh: {image_path}")
    mime_type = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
    image_b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    bin_compartment = "Chưa xác định"
    instructions = []
    disposal_method = ""
    note = ""
    if args.classify:
        classify_request = urllib.request.Request(
            args.server.rstrip("/") + "/api/classify",
            data=json.dumps({"imageBase64": image_b64, "mimeType": mime_type}).encode("utf-8"),
            headers={"Content-Type": "application/json"}, method="POST",
        )
        try:
            with urllib.request.urlopen(classify_request, timeout=60) as response:
                classification = json.loads(response.read().decode("utf-8"))
            args.label = classification.get("wasteType", args.label)
            args.category = classification.get("category", args.category)
            args.confidence = float(classification.get("confidence", args.confidence))
            bin_compartment = classification.get("binCompartment", classification.get("binColor", bin_compartment))
            instructions = classification.get("instructions", [])
            disposal_method = classification.get("disposalMethod", "")
            note = classification.get("note", "")
            print("AI classification:", json.dumps(classification, ensure_ascii=False))
        except (urllib.error.HTTPError, urllib.error.URLError, json.JSONDecodeError) as exc:
            print(f"AI classification failed: {exc}")
            return 1

    payload = {
        "macAddress": args.mac_address,
        "eventType": "object-detected",
        "detectedLabel": args.label,
        "category": args.category,
        "binCompartment": bin_compartment,
        "confidence": args.confidence,
        "instructions": instructions,
        "disposalMethod": disposal_method,
        "note": note,
        "fillLevel": args.fill_level,
        "mimeType": mime_type,
        "imageBase64": image_b64,
    }
    request = urllib.request.Request(
        args.server.rstrip("/") + "/api/bin-events",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            print(response.read().decode("utf-8"))
        return 0
    except urllib.error.HTTPError as exc:
        print(f"API error {exc.code}: {exc.read().decode('utf-8', errors='replace')}")
    except urllib.error.URLError as exc:
        print(f"Không kết nối được backend: {exc.reason}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
