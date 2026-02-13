!include "MUI2.nsh"

; Define custom colors *before* macros
!define MUI_BGCOLOR "1E1F20"
!define MUI_TEXTCOLOR "E3E3E3"

; Set branding text (small text at bottom left)
!define MUI_BRANDINGTEXT "LyricVault - Designed by McEveritts"

; Macro to override pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

; Attempt to enable Dark Mode support for the title bar on Windows 10/11
Function .onInit
    ; Dark Mode Explerer theme for controls
    System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "DarkMode_Explorer", w "DarkMode_Explorer")'
    System::Call 'uxtheme::SetWindowTheme(i $HWND, w "DarkMode_Explorer", w "DarkMode_Explorer")'
    
    ; Force window background color
    SetCtlColors $HWND 0xE3E3E3 0x1E1F20
FunctionEnd
