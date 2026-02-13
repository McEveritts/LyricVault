; Custom NSIS tweaks for electron-builder.
!include "LogicLib.nsh"
; Important: do NOT insert MUI pages/unpages/languages here.
; electron-builder controls page order and language setup.

!define MUI_BGCOLOR "131314"
!define MUI_TEXTCOLOR "E3E3E3"
!define LV_GOLD "E2C286"

!define MUI_BRANDINGTEXT "LyricVault - Designed by McEveritts"

; Hook into the Page Show callbacks to theme dynamic elements (like inner dialog 1018)
; !define MUI_PAGE_CUSTOMFUNCTION_SHOW LV_PageShow
; !define MUI_UNPAGE_CUSTOMFUNCTION_SHOW un.LV_PageShow

; Still keep GUIINIT for the main window frame
!define MUI_CUSTOMFUNCTION_GUIINIT LV_GuiInit
!define MUI_CUSTOMFUNCTION_UNGUIINIT un.LV_GuiInit

Function LV_ApplyTheme
    ; $0 must hold the HWND to theme
    SetCtlColors $0 0x${MUI_TEXTCOLOR} 0x${MUI_BGCOLOR}
FunctionEnd

Function LV_GuiInit
    ; Apply dark explorer theme to the main window
    System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "DarkMode_Explorer", w "DarkMode_Explorer")'
    
    ; Color the main background
    Push $HWNDPARENT
    Call LV_ApplyTheme

    ; Branding text (1028) - Gold
    GetDlgItem $0 $HWNDPARENT 1028
    StrCmp $0 0 +2
    SetCtlColors $0 0x${LV_GOLD} transparent
FunctionEnd

Function un.LV_GuiInit
    System::Call 'uxtheme::SetWindowTheme(i $HWNDPARENT, w "DarkMode_Explorer", w "DarkMode_Explorer")'
    Push $HWNDPARENT
    Call un.LV_ApplyTheme
    
    GetDlgItem $0 $HWNDPARENT 1028
    StrCmp $0 0 +2
    SetCtlColors $0 0x${LV_GOLD} transparent
FunctionEnd

Function LV_PageShow
    ; Inner dialog (1018) - The container
    GetDlgItem $0 $HWNDPARENT 1018
    StrCmp $0 0 +2
    SetCtlColors $0 0x${MUI_TEXTCOLOR} 0x${MUI_BGCOLOR}

    ; Iterate through common control IDs to force dark theme
    ; Directory Page: 1019 (Edit), 1006 (Text), 1023 (Space Available), 1024 (Space Required), 1001 (Browse - usually button, cant color easily without plugin)
    ; InstFiles Page: 1004 (Progress), 1016 (Log/List), 1006 (Status text)
    
    ; We'll just hammer a bunch of potential static/edit controls
    ${For} $1 1000 1029
        GetDlgItem $0 $HWNDPARENT $1
        StrCmp $0 0 next_ctrl
        SetCtlColors $0 0x${MUI_TEXTCOLOR} 0x${MUI_BGCOLOR}
    next_ctrl:
    ${Next}
    
    ; Specific fix for "Run LyricVault" Checkbox (1203) on Finish Page
    GetDlgItem $0 $HWNDPARENT 1203
    StrCmp $0 0 +2
    SetCtlColors $0 0x${MUI_TEXTCOLOR} 0x${MUI_BGCOLOR}
FunctionEnd

Function un.LV_PageShow
    ; Uninstaller inner dialog
    GetDlgItem $0 $HWNDPARENT 1018
    StrCmp $0 0 +2
    SetCtlColors $0 0x${MUI_TEXTCOLOR} 0x${MUI_BGCOLOR}

    ; Hammer controls for uninstaller too
    ${For} $1 1000 1029
        GetDlgItem $0 $HWNDPARENT $1
        StrCmp $0 0 un_next_ctrl
        SetCtlColors $0 0x${MUI_TEXTCOLOR} 0x${MUI_BGCOLOR}
    un_next_ctrl:
    ${Next}
FunctionEnd

; Helper for uninstaller (needs its own function because of NSIS scope)
Function un.LV_ApplyTheme
    SetCtlColors $0 0x${MUI_TEXTCOLOR} 0x${MUI_BGCOLOR}
FunctionEnd
