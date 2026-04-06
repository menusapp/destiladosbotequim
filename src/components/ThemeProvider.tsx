import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: Omit<ThemeProviderProps, 'forcedTheme' | 'enableSystem'>) {
  return (
    <NextThemesProvider {...props} forcedTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  )
}
