package in.gov.shirpur.cleantrack;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static final String TRUCK_ALERT_CHANNEL_ID = "cleantrack_truck_alerts";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Prevent native NullPointerExceptions from killing the app process
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            android.util.Log.e("CleanTrack", "Suppressed unhandled exception on " + thread.getName(), throwable);
            if (throwable instanceof NullPointerException) {
                android.util.Log.w("CleanTrack", "Ignored NullPointerException from native plugin/coroutine");
                return;
            }
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Garbage Truck Live Alerts";
            String description = "Real-time alerts when Shirpur garbage trucks are arriving at your doorstep";
            int importance = NotificationManager.IMPORTANCE_HIGH; // Enables floating heads-up pop-up & lockscreen display

            NotificationChannel channel = new NotificationChannel(TRUCK_ALERT_CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 250, 150, 250});
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + R.raw.truck_bell);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .build();

            channel.setSound(soundUri, audioAttributes);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
