!macro customInstall
  ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --install-fast-print --fast-print-quiet' $0
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "The app was installed, but Fast Print registration failed (code $0). Please report this code so the Explorer integration can be repaired."
  ${EndIf}
!macroend

!macro customUnInstall
  ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --remove-fast-print --fast-print-quiet' $0
!macroend
