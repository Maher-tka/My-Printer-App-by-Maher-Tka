!macro customInstall
  ${If} $installMode == "all"
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --install-fast-print-machine --fast-print-quiet' $0
  ${Else}
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --install-fast-print --fast-print-quiet' $0
  ${EndIf}
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Fast Print registration failed (code $0). Please report this code." /SD IDOK
  ${EndIf}
!macroend

!macro customUnInstall
  ${If} $installMode == "all"
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --remove-fast-print-machine --fast-print-quiet' $0
  ${Else}
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --remove-fast-print --fast-print-quiet' $0
  ${EndIf}
!macroend
