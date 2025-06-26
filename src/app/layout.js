import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const noto_sans_thai = Noto_Sans_Thai({
  subsets: ['thai'],
  weight: '400'
})

export const metadata = {
  title: "Mitrphol Dashboard Machine Learning",
  description: "",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${noto_sans_thai.className}`}
      >
        {children}
      </body>
    </html>
  );
}
