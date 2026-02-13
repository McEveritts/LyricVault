!include "MUI2.nsh"
!include "WinMessages.nsh"

; Define custom colors
!define MUI_BGCOLOR "131314"
!define MUI_TEXTCOLOR "E3E3E3"
!define LV_GOLD "E2C286"

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

; Custom UI Initialization
!define MUI_CUSTOMFUNCTION_GUIINIT MyGuiInit

Function MyGuiInit
    ; Dark Mode Explorer theme for controls
    System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "DarkMode_Explorer", w "DarkMode_Explorer")'
    
    ; Apply dark background to the main window
    SetCtlColors $HWNDPARENT 0x${MUI_TEXTCOLOR} 0x${MUI_BGCOLOR}
FunctionEnd

Function .onInit
    ; Force window background color
    System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "DarkMode_Explorer", w "DarkMode_Explorer")'

    ; Set the branding text color to gold
    GetDlgItem $0 $HWNDPARENT 1028
    SetCtlColors $0 0x${LV_GOLD} transparent
FunctionEnd
