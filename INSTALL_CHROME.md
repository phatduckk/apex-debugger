# Chrome Installation

You'll download the extension files from GitHub and load them manually into Chrome. This takes about two minutes.

> **Safari users:** you can delete the `Apex Debugger.zip` file from the download — it's only needed for Safari.

## Step 1 — Download the extension

1. Go to **[https://github.com/phatduckk/apex-debugger](https://github.com/phatduckk/apex-debugger)**
2. Click the green **`< > Code`** button near the top right
3. Click **Download ZIP**
4. Once downloaded, **unzip** the file — on Mac, double-click it; on Windows, right-click → _Extract All_
5. You should now have a folder called **`apex-debugger-main`** (or similar). Move it somewhere you won't accidentally delete it (e.g. your Documents folder)

## Step 2 — Load it into Chrome

1. Open **Google Chrome**
2. In the address bar, type `chrome://extensions` and press Enter
3. In the top-right corner of that page, turn on **Developer mode** (toggle switch)
4. Click the **Load unpacked** button that appears

   ![Chrome extensions page showing Developer mode toggle and Load unpacked button](img/chrome-extensions-header.png)

5. Navigate to the `apex-debugger-main` folder you unzipped and select it
6. The **Apex Debugger** extension will appear in your list — click **Enable** if it isn't already active

   ![Apex Debugger extension card with Enable button](img/enable-extension.png)

> **Note:** The extension only runs while it's loaded here. Don't delete the folder after installing or Chrome will lose track of it.

## Updating

1. Download the latest ZIP from GitHub (same link as above) and unzip it
2. Replace the files in your existing `apex-debugger-main` folder with the new ones
3. Go to `chrome://extensions` and click the **refresh icon** on the Apex Debugger card to reload it

   ![Apex Debugger extension card showing the refresh button](img/refresh.png)

That's all — no need to re-add or reconfigure anything.
