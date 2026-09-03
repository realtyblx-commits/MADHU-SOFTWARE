import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function generatePayslipPDF(
  element: HTMLElement,
  filename = "BLX_Payslip.pdf"
): Promise<jsPDF> {
  // Wait for any images to complete rendering
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })
  );

  const canvas = await html2canvas(element, {
    scale: 2, // Retina resolution for crystal-clear text and borders
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: "#ffffff",
    windowWidth: 1024,
    onclone: (clonedDoc, clonedElement) => {
      // 1. Remove dark mode from cloned document
      clonedDoc.documentElement.classList.remove("dark");
      clonedDoc.body.classList.remove("dark");

      // 2. Sanitize any potential oklch definitions across all stylesheets in the clone
      const styles = Array.from(clonedDoc.querySelectorAll("style, link[rel='stylesheet']"));
      styles.forEach((styleTag) => {
        if (styleTag.textContent && styleTag.textContent.includes("oklch")) {
          styleTag.textContent = styleTag.textContent.replace(/oklch\([^)]+\)/g, "#000000");
        }
      });

      // 3. Force pure white document background and black text on cloned target
      clonedElement.style.backgroundColor = "#ffffff";
      clonedElement.style.color = "#000000";
      clonedElement.style.borderColor = "#000000";

      // 4. Force all borders and text inside the cloned payslip to safe hex
      const allElements = Array.from(clonedElement.querySelectorAll("*"));
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style) {
          if (htmlEl.tagName === "TABLE" || htmlEl.tagName === "TH" || htmlEl.tagName === "TD") {
            htmlEl.style.borderColor = "#000000";
          }
        }
      });
    },
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, "PNG", 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));
  return pdf;
}

export async function downloadPayslipPDF(
  element: HTMLElement,
  filename = "BLX_Payslip.pdf"
): Promise<void> {
  const pdf = await generatePayslipPDF(element, filename);
  pdf.save(filename);
}

export function printPayslip(): void {
  window.print();
}
