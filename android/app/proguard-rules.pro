# Add project specific ProGuard rules here.
# Keep Capacitor and Plugins
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class io.ionic.libs.** { *; }
-keep class com.google.android.gms.location.** { *; }
-keep class com.google.android.gms.common.** { *; }
-dontwarn com.google.android.gms.**
-dontwarn io.ionic.libs.**
-dontwarn com.capacitorjs.plugins.**

# Preserve WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keepattributes JavascriptInterface
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
