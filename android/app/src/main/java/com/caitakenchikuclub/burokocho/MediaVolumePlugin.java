package com.caitakenchikuclub.burokocho;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tells the game the phone's media volume, so it keeps its sound engine stopped while the volume is 0
 * (otherwise a short blip can slip out when the sound restarts after an ad or a return from the background).
 * get() → { level, max };  "change" event → { level, max } whenever the media volume changes.
 */
@CapacitorPlugin(name = "MediaVolume")
public class MediaVolumePlugin extends Plugin {

    private static final String VOLUME_CHANGED = "android.media.VOLUME_CHANGED_ACTION";
    private static final String EXTRA_STREAM = "android.media.EXTRA_VOLUME_STREAM_TYPE";
    private BroadcastReceiver receiver;

    private JSObject read() {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        JSObject r = new JSObject();
        r.put("level", am.getStreamVolume(AudioManager.STREAM_MUSIC));
        r.put("max", am.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
        return r;
    }

    @Override
    public void load() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent.getIntExtra(EXTRA_STREAM, -1) == AudioManager.STREAM_MUSIC) notifyListeners("change", read());
            }
        };
        ContextCompat.registerReceiver(getContext(), receiver, new IntentFilter(VOLUME_CHANGED), ContextCompat.RECEIVER_EXPORTED);   // sent by the system; a fake one only makes us re-read the volume
    }

    @Override
    protected void handleOnDestroy() {
        if (receiver != null) getContext().unregisterReceiver(receiver);
        receiver = null;
    }

    @PluginMethod
    public void get(PluginCall call) {
        call.resolve(read());
    }
}
