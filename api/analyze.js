const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFDocument } = require("pdf-lib");

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { imageBase64 } = req.body;
  
  try {
    const pdfDoc = await PDFDocument.create();
    const imageBytes = Buffer.from(imageBase64, 'base64');
    const image = await pdfDoc.embedJpg(imageBytes);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    const pdfBytes = await pdfDoc.save();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const result = await model.generateContent([
      { inlineData: { data: Buffer.from(pdfBytes).toString("base64"), mimeType: "application/pdf" } },
      "Extract table to JSON."
    ]);

    const text = result.response.text();
    const jsonStr = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0] || text;
    res.status(200).json(JSON.parse(jsonStr));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
