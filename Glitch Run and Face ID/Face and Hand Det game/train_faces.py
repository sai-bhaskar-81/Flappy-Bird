
import cv2
import os
import mediapipe as mp

person_id = input("Enter person ID: ")

folder = f"faces/{person_id}"
os.makedirs(folder, exist_ok=True)

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

BaseOptions = mp.tasks.BaseOptions
FaceDetector = mp.tasks.vision.FaceDetector
FaceDetectorOptions = mp.tasks.vision.FaceDetectorOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = FaceDetectorOptions(
    base_options=BaseOptions(
        model_asset_path="blaze_face_short_range.tflite"
    ),
    running_mode=VisionRunningMode.IMAGE,
    min_detection_confidence=0.5
)

detector = FaceDetector.create_from_options(options)

count = 0

while count < 30:

    ret, frame = cap.read()

    if not ret:
        print("Camera error")
        break

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb
    )

    result = detector.detect(mp_image)

    for detection in result.detections:

        box = detection.bounding_box

        x = max(0, box.origin_x)
        y = max(0, box.origin_y)
        w = box.width
        h = box.height

        x2 = min(frame.shape[1], x + w)
        y2 = min(frame.shape[0], y + h)

        if x2 <= x or y2 <= y:
            continue

        face = cv2.cvtColor(
            frame[y:y2, x:x2],
            cv2.COLOR_BGR2GRAY
        )

        cv2.imwrite(
            f"{folder}/{count}.jpg",
            face
        )

        count += 1

        cv2.rectangle(
            frame,
            (x, y),
            (x2, y2),
            (0, 255, 0),
            2
        )

        break

    cv2.putText(
        frame,
        f"ID: {person_id}  Samples: {count}/30",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 255, 0),
        2
    )

    cv2.imshow("Face Training", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
detector.close()

print(f"Saved {count} samples for ID {person_id}")
