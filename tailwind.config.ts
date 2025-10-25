import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx,mdx}"
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      },
      colors: {
        // Custom colors
        bg: "var(--bg)",
        surface: {
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)"
        },
        border: "var(--border)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)"
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
        
        // Map Tailwind semantic colors to CSS variables
        background: "var(--surface-1)",
        foreground: "var(--text-primary)",
        card: {
          DEFAULT: "var(--surface-1)",
          foreground: "var(--text-primary)"
        },
        popover: {
          DEFAULT: "var(--surface-1)",
          foreground: "var(--text-primary)"
        },
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "var(--surface-1)"
        },
        secondary: {
          DEFAULT: "var(--surface-2)",
          foreground: "var(--text-primary)"
        },
        muted: {
          DEFAULT: "var(--surface-2)",
          foreground: "var(--text-muted)"
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--surface-1)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)"
        },
        destructive: {
          DEFAULT: "var(--danger)",
          foreground: "var(--surface-1)"
        },
        border: "var(--border)",
        input: "var(--border)",
        ring: "var(--accent)",
        chart: {
          "1": "var(--chart-s1)",
          "2": "var(--chart-s2)",
          "3": "var(--chart-s3)",
          "4": "var(--chart-s4)",
          "5": "var(--chart-s5)"
        }
      },
      borderRadius: {
        xs: "var(--r-xs)",
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)"
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)"
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px"
      }
    }
  },
  plugins: []
} satisfies Config;
