
import cv2
import mediapipe as mp
import math

BaseOptions = mp.tasks.BaseOptions
FaceDetector = mp.tasks.vision.FaceDetector
FaceDetectorOptions = mp.tasks.vision.FaceDetectorOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = FaceDetectorOptions(
    base_options=BaseOptions(
        model_asset_path="blaze_face_short_range.tflite"
    ),
    running_mode=VisionRunningMode.IMAGE
)

detector = FaceDetector.create_from_options(options)

cap = cv2.VideoCapture(0)

cv2.namedWindow("Face Tracking", cv2.WINDOW_NORMAL)
cv2.resizeWindow("Face Tracking", 1280, 720)

faces = {}
next_id = 0

while True:
    ret, frame = cap.read()

    if not ret:
        break

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb
    )

    result = detector.detect(mp_image)

    detected = []

    for detection in result.detections:
        box = detection.bounding_box

        x = box.origin_x
        y = box.origin_y
        w = box.width
        h = box.height

        cx = x + w // 2
        cy = y + h // 2

        detected.append((x, y, w, h, cx, cy))

    used_ids = set()

    for x, y, w, h, cx, cy in detected:

        best_id = None
        best_distance = float("inf")

        for face_id, data in faces.items():

            if face_id in used_ids:
                continue

            old_cx, old_cy, missed = data

            distance = math.sqrt(
                (cx - old_cx) ** 2 +
                (cy - old_cy) ** 2
            )

            if distance < best_distance and distance < 150:
                best_distance = distance
                best_id = face_id

        if best_id is None:
            best_id = next_id
            next_id += 1

        faces[best_id] = (cx, cy, 0)
        used_ids.add(best_id)

        cv2.rectangle(
            frame,
            (x, y),
            (x + w, y + h),
            (0, 255, 0),
            2
        )

        cv2.putText(
            frame,
            f"Face {best_id}",
            (x, max(y - 10, 25)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )

    for face_id in list(faces.keys()):

        if face_id not in used_ids:

            cx, cy, missed = faces[face_id]

            missed += 1

            if missed > 30:
                del faces[face_id]
            else:
                faces[face_id] = (cx, cy, missed)

    cv2.putText(
        frame,
        f"Faces: {len(detected)}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2
    )

    cv2.imshow("Face Tracking", frame)

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q"):
        break

cap.release()
detector.close()
cv2.destroyAllWindows()