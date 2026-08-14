import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function htmlPartials() {
  return {
    name: 'html-partials',
    transformIndexHtml(html) {
      const header = readFileSync(resolve(__dirname, 'partials/_header.html'), 'utf-8');
      const footer = readFileSync(resolve(__dirname, 'partials/_footer.html'), 'utf-8');
      return html
        .replace('<!--HEADER-->', header)
        .replace('<!--FOOTER-->', footer);
    },
  };
}

export default defineConfig({
  plugins: [htmlPartials()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        image: resolve(__dirname, 'image.html'),
        word: resolve(__dirname, 'word.html'),
        excel: resolve(__dirname, 'excel.html'),
        pdf: resolve(__dirname, 'pdf.html'),
        ppt: resolve(__dirname, 'ppt.html'),
        text: resolve(__dirname, 'text.html'),
        utilities: resolve(__dirname, 'utilities.html'),
      },
    },
  },
});
