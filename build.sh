#!/bin/bash
# Manual build: aapt2 -> javac -> d8 -> zipalign -> apksigner
set -e
export JAVA_HOME=$HOME/android-sdk/jdk-17.0.11+9
export PATH=$JAVA_HOME/bin:$PATH
SDK=$HOME/Android/Sdk
BT=$SDK/build-tools/34.0.0
PLATFORM=$SDK/platforms/android-34/android.jar
PROJ=$HOME/workspace/ihesab-android/android/app/src/main
WWW=$HOME/workspace/ihesab-android/www
OUT=$HOME/workspace/ihesab-android/build
APK_OUT=$HOME/workspace/your_files

rm -rf $OUT
mkdir -p $OUT/gen $OUT/obj $OUT/dex $OUT/assets $APK_OUT
cp $WWW/index.html $WWW/styles.css $WWW/app.js $WWW/logo.png $WWW/xlsx.full.min.js $WWW/zxing.min.js $OUT/assets/
mkdir -p $OUT/assets/ocr && cp $WWW/ocr/* $OUT/assets/ocr/
# فونت‌ها از نسخه ۳٫۵ به‌صورت data URI داخل styles.css جاسازی شده‌اند؛ کپی فایل جدا لازم نیست

echo "== aapt2 compile =="
$BT/aapt2 compile --dir $PROJ/res -o $OUT/res.zip

echo "== aapt2 link =="
$BT/aapt2 link -o $OUT/app.apk \
  -I $PLATFORM \
  --manifest $PROJ/AndroidManifest.xml \
  --java $OUT/gen \
  -A $OUT/assets \
  $OUT/res.zip \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 34 \
  --version-name 7.6


echo "== javac =="
find $PROJ/java $OUT/gen -name "*.java" > $OUT/sources.txt
javac -encoding UTF-8 -cp $PLATFORM -d $OUT/obj @$OUT/sources.txt

echo "== d8 =="
$BT/d8 --lib $PLATFORM --output $OUT/dex $(find $OUT/obj -name "*.class")

echo "== add dex =="
cp $OUT/app.apk $OUT/app-unsigned.apk
cd $OUT/dex && zip -q -r ../app-unsigned.apk classes.dex && cd - > /dev/null

echo "== zipalign =="
$BT/zipalign -f 4 $OUT/app-unsigned.apk $OUT/app-aligned.apk

echo "== apksigner =="
$BT/apksigner sign --ks $HOME/workspace/ihesab-android/keystore/ihesab.keystore \
  --ks-pass pass:CHANGE_ME --key-pass pass:CHANGE_ME \
  --out $APK_OUT/ihesab.apk $OUT/app-aligned.apk

echo "== verify =="
$BT/apksigner verify --print-certs $APK_OUT/ihesab.apk | head -3
ls -la $APK_OUT/ihesab.apk
echo "BUILD DONE"
