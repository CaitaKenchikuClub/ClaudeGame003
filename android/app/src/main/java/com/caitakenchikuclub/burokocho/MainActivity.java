package com.caitakenchikuclub.burokocho;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BuildInfoPlugin.class);   // debug / release for ads.js
        super.onCreate(savedInstanceState);
    }
}
