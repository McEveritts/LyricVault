; Custom NSIS tweaks for electron-builder.
; Important: do NOT insert MUI pages/unpages/languages here.
; electron-builder controls page order and language setup.

!define MUI_BGCOLOR "131314"
!define MUI_TEXTCOLOR "E3E3E3"
!define LV_GOLD "E2C286"

!define MUI_BRANDINGTEXT "LyricVault - Designed by McEveritts"

; Called by MUI2 after the wizard window is created.
!define MUI_CUSTOMFUNCTION_GUIINIT LV_GuiInit
!define MUI_UNCUSTOMFUNCTION_GUIINIT un.LV_GuiInit

Function LV_GuiInit
    ; Apply dark explorer theme when available (safe no-op if unsupported).
    System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "DarkMode_Explorer", w "DarkMode_Explorer")'

    ; Dark background + light text for the main wizard.
    SetCtlColors $HWNDPARENT 0x${MUI_TEXTCOLOR} 0x${MUI_BGCOLOR}

    ; Branding text control (bottom-left). Make it gold if present.
    GetDlgItem $0 $HWNDPARENT 1028
    StrCmp $0 0 +2
    SetCtlColors $0 0x${LV_GOLD} transparent
FunctionEnd

Function un.LV_GuiInit
    System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "DarkMode_Explorer", w "DarkMode_Explorer")'
    SetCtlColors $HWNDPARENT 0x${MUI_TEXTCOLOR} 0x${MUI_BGCOLOR}

    GetDlgItem $0 $HWNDPARENT 1028
    StrCmp $0 0 +2
    SetCtlColors $0 0x${LV_GOLD} transparent
FunctionEnd
