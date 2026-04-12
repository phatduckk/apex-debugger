In Neptune Apex programming, the last true statement rule dictates that the controller evaluates code from top to bottom, and the final statement that evaluates to "true" determines the outlet's final state. This means subsequent lines of code can override previous ones, making order critical. 

 
How it Works: If you have multiple If statements, the Apex processes them sequentially, and the last one that is true wins.