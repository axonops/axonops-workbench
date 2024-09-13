!macro customUnInstall
  MessageBox MB_YESNO "Do you want to remove all application data?" IDNO SkipDataRemoval
    RMDir /r "$PROFILE\axonops-workbench"
  SkipDataRemoval:
!macroend