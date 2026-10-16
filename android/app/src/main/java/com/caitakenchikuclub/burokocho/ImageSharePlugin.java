package com.caitakenchikuclub.burokocho;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Shares the result image (a PNG in the app's cache) with text through the Android share sheet.
 * Unlike @capacitor/share, it gives every app that can receive the image a read permission that lasts
 * beyond the share screen: X (Twitter) uploads the image in the background after "Post", and with only the
 * short-lived permission of the share intent its upload never finishes ("processing media" forever).
 * share({ file: "file:///…png", text, title, dialogTitle })
 */
@CapacitorPlugin(name = "ImageShare")
public class ImageSharePlugin extends Plugin {

    @PluginMethod
    public void share(PluginCall call) {
        String file = call.getString("file");
        if (file == null) {
            call.reject("file is required");
            return;
        }
        try {
            Context ctx = getContext();
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", new File(Uri.parse(file).getPath()));
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            String text = call.getString("text");
            if (text != null) send.putExtra(Intent.EXTRA_TEXT, text);
            String title = call.getString("title");
            if (title != null) send.putExtra(Intent.EXTRA_SUBJECT, title);
            send.setClipData(ClipData.newRawUri("", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            // lasting read permission for each app that can receive the image (needs <queries> in AndroidManifest.xml)
            for (ResolveInfo ri : ctx.getPackageManager().queryIntentActivities(send, PackageManager.MATCH_DEFAULT_ONLY)) {
                ctx.grantUriPermission(ri.activityInfo.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
            getActivity().startActivity(Intent.createChooser(send, call.getString("dialogTitle", "Share")));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getLocalizedMessage());
        }
    }
}
