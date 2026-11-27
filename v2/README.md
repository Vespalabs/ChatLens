# ChatLens 2.0 interface preview

This is a private development build. It is separate from the public beta.

Extract the preview ZIP into one folder and open `index.html` in a recent browser. Choose **Show sample** or select one or more WhatsApp TXT exports. When combining files, confirm that the exports cover the same conversation and use the same date format and displayed clock.

Analysis runs locally in the browser. Chat content is not uploaded. This preview supports TXT files. ZIP import and account access are not included. **Print / save PDF** opens the browser print flow. **Download text** saves a text report. **Share** uses the browser share sheet when available.

The sample report uses fictional messages. Run the regression checks after loading `data-engine.js` and `whatsapp-import.js`, then load `data-engine.test.js`.