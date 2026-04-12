Here's how we should do the README

First have an intro:
 * Explain that this is a browser extension for Chrome and Safari that adds useful features to Apex Fusion.
 * Explain that it works on apex.local because it needs access to info accessible from apex.local

 Features section:
 * features is the H1
 * add an H2 for each feature
 * if i say use a GIF - its in the img/ folder. Also center all GIFs
 * here's each feature
 	* ability to search and filer the unused widgets section
 		* use widgets.gif
	* find references of each input, output & probe from the dashboard.
		* use dash-references.gif
		* tell them that they can click on the magnifier icon and then a panel shows up below
		* explain the panel shows where its referened as a single line of code but you can click on that LOC to see the full code
		* clicking on the name of the referene takes you right to the edit page so you can edit the code
	* explore
		* use explore.gif
		* explore is like the show references we just discussed but for all your inputs, outputs & probes
		* it also can show all the stuff that does NOT reference the thing you selected
		* mention you can search for stuff in the left column
		* also tell them SET and FALLBACK are included as a convenience
		* tell them they get to explore via the new option in the ? button on the dashboard
	* Code debugger
		* use debugger.gif
		* explain the gutter and line colors
		* explain how its immediate and reflects changes when you change the code
		* explain the hover over things in the gutter
	* References from Output/Input pages
		* explain that the references panel is also available from the output and inputs page directly
		* explain how it works... more or less same as the references you explains above from the dashboard
		* use page-ref.gif
	* Legend 
		* use legend.gif
		* explain you get to it from the light bulb icon from the output and inputs page directly
		* explain what the legend does
			* explains the debugger
			* shows what the extension can and cant evaluate
			* has coding references to help you write new code


Installation Section:
	* take the current installation info and make a Safari page and a separate Chrome Page
	* you can reuse the content we already have
	* Link to each of those			
