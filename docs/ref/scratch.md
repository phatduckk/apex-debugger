### activate/deactivate the debugger and help

* the site is an SPA
* currently when you activate the help and leave the page the help panel is still there. it should go away when the user leaves the page
* same with the debugger. here's a bug to fix
  * turn the debugger on
    * the debug button has enabled color
    * code is highlighted properly
    * all good
  * leave the page
    * enter another page with a code editor
    * the debug button has disabled color
    * BUT the editor line & gutter highlighting is on
    * it should be off
    * so every time you leave the page the debugger and help should turn "off"
      * the user can manually toggle it on when they want


