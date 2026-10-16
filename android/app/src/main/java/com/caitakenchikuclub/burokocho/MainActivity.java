package com.caitakenchikuclub.burokocho;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BuildInfoPlugin.class);   // debug / release for ads.js
        registerPlugin(MediaVolumePlugin.class);   // media volume 0 → the game keeps its sound stopped
        registerPlugin(ImageSharePlugin.class);   // result image share that X can upload in the background
        super.onCreate(savedInstanceState);
    }
}
