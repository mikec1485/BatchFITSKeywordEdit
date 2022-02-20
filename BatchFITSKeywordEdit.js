
 /*
 ****************************************************************************
 * Batch FITS Keyword Edit
 *
 * BatchFITSKeywordEdit.js
 * Copyright (C) 2021, Mike Cranfield
 *
 * This script allows batch editing of FITS keywords in FITS files.
 *
 * This product is based on software from the PixInsight project, developed
 * by Pleiades Astrophoto and its contributors (https://pixinsight.com/).
 *
 * Version history
 * 1.0   2021-09-14 first release
 *
 *
 *
 ****************************************************************************
 */

// ----------------------------------------------------------------------------
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the
// Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// this program.  If not, see <http://www.gnu.org/licenses/>.
// ----------------------------------------------------------------------------


#feature-id    BatchFITSKeywordEdit : Batch Processing > BatchFITSKeywordEdit

#feature-info  A batch utility to edit, add or remove a FITS keyword.<br/>\
   <br/> \
   This script allows you to specify a list of FITS files to be processed and to \
   specify a keyword to edit.  The keyword may be added as a new keyword, \
   amended within the existing keywords in the file HDU, or removed from \
   the HDU.  The edited files will be written to a specified output directory \
   and can include an identifying prefix/postfix.  The script is only designed \
   to work with FITS files (extensions: .fit, .fits, .fts). <br>\
   <br>\
   This script can be useful, for example, to add specification of the filter \
   used in image capture when this was not written to the files at the time \
   of capture. <br/>\
   <br/>\
   Written by Michael Cranfield<br/>\
   Copyright &copy; 2021, Michael Cranfield<br/>\
   <br/>\


#include <pjsr/ColorSpace.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/SectionBar.jsh>

#define DEFAULT_OUTPUT_EXTENSION ".fit"

#define WARN_ON_NO_OUTPUT_DIRECTORY 1

#define VERSION "1.0.0"
#define TITLE   "BatchFITSKeywordEdit"

if ( CoreApplication === undefined ||
     CoreApplication.versionRevision === undefined ||
     CoreApplication.versionMajor*1e11
   + CoreApplication.versionMinor*1e8
   + CoreApplication.versionRelease*1e5
   + CoreApplication.versionRevision*1e2 < 100800800900 )
{
   throw new Error( "This script requires PixInsight version 1.8.8-9 or higher." );
}

/*
 * Batch FITS Keyword update engine
 */
function BatchFITSKeywordEditEngine()
{
   this.inputFiles = new Array;
   this.outputDirectory = "";
   this.outputPrefix = "";
   this.outputPostfix = "_f";
   this.outputExtension = DEFAULT_OUTPUT_EXTENSION;
   this.overwriteExisting = false;
   this.outputFormat = null;

   this.actionAdd = true;
   this.actionEdit = false;
   this.actionRemove = false;

   this.keywordList = new Array(new FITSKeyword("","",""));
   this.editKeywordIndex = 0;
   this.removeKeywordIndex = 0;
   this.locationKeywordIndex = 0;

   this.addKeyword = "";
   this.addValue = "";
   this.addComment = "";
   this.addLocation = function()
   {
      return this.keywordList[this.locationKeywordIndex];
   }
   this.addMatchName = false;
   this.addBeforeAfter = "before";
   this.addDuplicates = false;

   this.editKeyword = function()
   {
      return this.keywordList[this.editKeywordIndex];
   }
   this.editMatchName = false;
   this.editValue = "";
   this.editComment = "";

   this.removeKeyword = function()
   {
      return this.keywordList[this.removeKeywordIndex];
   }
   this.removeMatchName = false;
   this.removeValue = "";
   this.removeComment = "";



   this.processFiles = function()
   {
      this.outputFormat = new FileFormat( this.outputExtension, false/*toRead*/, true/*toWrite*/ );
      if ( this.outputFormat.isNull )
         throw new Error( "No installed file format can write \'" + this.outputExtension + "\' files." );

      let succeeded = 0;
      let errored = 0;

      for ( let i = 0; i < this.inputFiles.length; ++i )
      {
         try
         {
            console.writeln( format( "<end><cbr><br><b>Processing file %u of %u:</b>", i+1, this.inputFiles.length ) );
            console.writeln( "<raw>" + this.inputFiles[i] + "</raw>" );

            //set up arrays
            let fitsKeys = new Array
            fitsKeys = this.readImageKeywords(this.inputFiles[i]);

            let newFitsKeys = new Array;

            //initialise variable that will hold position of the relevant keyword
            let keyWordIndex = -1;


            //editing existing keyword
            if ( this.actionEdit )
            {
               for ( let j = 0; j < fitsKeys.length; ++j )
               {
                  if ( isFITSEqual(this.editKeyword(), fitsKeys[j], this.editMatchName) )
                  {
                     keyWordIndex = j;
                  }
               }

               if (keyWordIndex < 0 )
               {
                  console.warningln("Keyword not found - file not processed");
                  errored++;
               }
               else
               {
                  fitsKeys[keyWordIndex].value = this.editValue;
                  fitsKeys[keyWordIndex].comment = this.editComment;

                  this.writeImageKeywords(this.inputFiles[i], fitsKeys);
                  succeeded++;
               }
            }

            //adding new keyword
            if ( this.actionAdd )
            {

               //first check if the keyword already exists
               let duplicateWarning = false;
               for ( let j = 0; j<fitsKeys.length; ++j )
               {
                  if ( this.addKeyword.toUpperCase().trim() == fitsKeys[j].name.toUpperCase().trim() )
                  {
                     duplicateWarning = true;
                  }
               }

               //deal with duplicate warnings as necessary
               if ( duplicateWarning )
               {
                  if ( !this.addDuplicates )
                  {
                     console.criticalln("Duplicate keyword - file not processed");
                  }
                  else
                  {
                     console.warningln("Duplicate keyword - file processed anyway");
                  }
               }

               //continue processing only if not stopped by duplicates
               if ( (!duplicateWarning) || this.addDuplicates )
               {
                  let newFitsKeyword =  new FITSKeyword;
                  newFitsKeyword.name = this.addKeyword;
                  newFitsKeyword.value = this.addValue;
                  newFitsKeyword.comment = this.addComment;

                  let beforeAfterAdjust = 0;
                  if (this.addBeforeAfter == "after") {beforeAfterAdjust = 1;}

                  //if location for new keyword is blank then place at the end
                  if ( this.addLocation().name == "" )
                  {
                     keyWordIndex = fitsKeys.length;
                  }
                  //if location given then find it
                  else
                  {
                     for ( let j = 0; j < fitsKeys.length; ++j )
                     {
                        if ( isFITSEqual( this.addLocation(), fitsKeys[j], this.addMatchName ) )
                        {
                           keyWordIndex = j + beforeAfterAdjust;
                        }
                     }
                  }

                  //populate the new keyword array
                  for ( let j = 0; j < Math.min(fitsKeys.length, keyWordIndex); ++j )
                  {
                     newFitsKeys.push(fitsKeys[j]);
                  }

                  newFitsKeys.push(newFitsKeyword);

                  if (keyWordIndex != fitsKeys.length)
                  {
                     for ( let j = keyWordIndex; j<fitsKeys.length; ++j )
                     {
                        newFitsKeys.push(fitsKeys[j]);
                     }
                  }
                  this.writeImageKeywords(this.inputFiles[i], newFitsKeys);
                  succeeded++;
               }

               //execute this block if processing was stopped by duplicates
               else
               {
                  errored++
               }
            }

            //removing a keyword
            if (this.actionRemove)
            {
               let newFitsKeyword =  new FITSKeyword;
               newFitsKeyword.name = this.removeKeyword().name;
               newFitsKeyword.value = this.removeValue;
               newFitsKeyword.comment = this.removeComment;

               for ( let j = 0; j < fitsKeys.length; ++j )
               {
                  if ( isFITSEqual(this.removeKeyword(), fitsKeys[j], this.removeMatchName) )
                  {
                     keyWordIndex = j;
                  }
               }

               if (keyWordIndex < 0 )
               {
                  console.warningln("Keyword not found - file not processed");
                  errored++;
               }
               else
               {
                  //populate the new keyword array
                  for ( let j = 0; j < Math.min(fitsKeys.length, keyWordIndex); ++j )
                  {
                     newFitsKeys.push(fitsKeys[j]);
                  }



                  if (keyWordIndex < fitsKeys.length-1)
                  {
                     for ( let j = keyWordIndex+1; j<fitsKeys.length; ++j )
                     {
                        newFitsKeys.push(fitsKeys[j]);
                     }
                  }

                  this.writeImageKeywords(this.inputFiles[i], newFitsKeys);
                  succeeded++;
               }
            }
         }

         catch ( error )
         {
            ++errored;
            if ( i+1 == this.inputFiles.length )
               throw error;
            let errorMessage = "<p>" + error.message + ":</p>" +
                               "<p>" + this.inputFiles[i] + "</p>" +
                               "<p><b>Continue batch format conversion?</b></p>";
            if ( (new MessageBox( errorMessage, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No )).execute() != StdButton_Yes )
               break;
         }
      }

      if (this.actionAdd)
      {
         console.writeln("Keyword: ",this.addKeyword,", added ", this.addBeforeAfter," ", this.addLocation().name, " with value: ",this.addValue,", and comment: ",this.addComment)
      }
      if (this.actionEdit)
      {
         console.writeln("Keyword: ",this.editKeyword().name,", edited with value: ",this.editValue,", and comment: ",this.editComment)
      }
      if (this.actionRemove)
      {
         console.writeln("Keyword: ",this.removeKeyword().name,", removed")
      }
      console.writeln( format( "<end><cbr><br>===== %d succeeded, %u error%s, %u skipped =====",
                                 succeeded, errored, (errored == 1) ? "" : "s", this.inputFiles.length-succeeded-errored ) );

   }




   this.readImageKeywords = function( filePath )
   {
      let suffix = File.extractExtension( filePath );
      let lcSuffix = suffix.toLowerCase();

      let F = new FileFormat( suffix, true/*toRead*/, false/*toWrite*/ );
      if ( F.isNull )
         throw new Error( "No installed file format can read \'" + suffix + "\' files." );

      if (!( (lcSuffix == ".fit") || (lcSuffix == ".fits") || (lcSuffix == ".fts" )))
      {
         throw new Error( "This script is designed only for FITS files (*.fit, *.fits, *.fts)" );
      }

      this.outputExtension = suffix;

      let f = new FileFormatInstance( F );
      if ( f.isNull )
         throw new Error( "Unable to instantiate file format: " + F.name );

      let d = f.open( filePath );
      if ( d.length < 1 )
         throw new Error( "Unable to open file: " + filePath );
      if ( d.length > 1 )
         throw new Error( "Multi-image files are not supported by this script: " + filePath );

      let fitsKeys = f.keywords;
      f.close();

      //return data;
      return fitsKeys;
   };




   this.writeImageKeywords = function( filePath, fitsKeys )
   {
      let fileDir = (this.outputDirectory.length > 0) ? this.outputDirectory :
                    File.extractDrive( filePath ) + File.extractDirectory( filePath );
      if ( !fileDir.endsWith( '/' ) )
         fileDir += '/';
      let fileName = this.outputPrefix + File.extractName( filePath ) + this.outputPostfix;
      let outputFilePath = fileDir + fileName + this.outputExtension;

      console.writeln( "<end><cbr><br>Output file:" );

      if ( File.exists( outputFilePath ) )
      {
         if ( this.overwriteExisting )
         {
            //we shouldn't ever get here!
            throw new Error( "Processing halted to avoid overwriting existing file." );
            //console.warningln( "<end><cbr>** Warning: Overwriting existing file: " + outputFilePath );

         }
         else
         {
            console.noteln( "<end><cbr>* File already exists: " + outputFilePath );
            for ( let u = 1; ; ++u )
            {
               let tryFilePath = File.appendToName( outputFilePath, '_' + u.toString() );
               if ( !File.exists( tryFilePath ) )
               {
                  outputFilePath = tryFilePath;
                  break;
               }
            }
            console.noteln( "<end><cbr>* Writing to: <raw>" + outputFilePath + "</raw>" );
         }
      }
      else
      {
         console.writeln( "<raw>" + outputFilePath + "</raw>" );
      }

      let fmt = new FileFormat( this.outputExtension );
      let f = new FileFormatInstance( fmt );
      if ( f.isNull )
         throw new Error( "Unable to instantiate file format: " + this.outputFormat.name );

      let w = ImageWindow.open( filePath );
      w[0].keywords = fitsKeys;

      w[0].saveAs( outputFilePath,
                      false/*queryOptions*/,
                      false/*allowMessages*/,
                      false/*strict*/,
                      false/*verifyOverwrite*/ );

      w[0].forceClose();
   };



   this.ByteArrayToFITSKeyword = function( inputByteArray )
   {
      //Note this function does not support the HIERARCHs convention

      let fitsKeyword = new FITSKeyword("","","");

      if ( inputByteArray.length == 80 )
      {
         //extract name
         fitsKeyword.name = inputByteArray.toString( 0, 8 ).toUpperCase();

         //check if value type
         let hasValue = false;
         if (  ( inputByteArray.at( 8 ) === 61 ) &&
               ( inputByteArray.at( 9 ) === 32 ) &&
               ( fitsKeyword.name != "COMMENT"  ) &&
               ( fitsKeyword.name != "HISTORY"  ) &&
               ( fitsKeyword.name != ""  ))
         {
            hasValue = true;
         }

         if ( hasValue )
         {
            //find comment separator slash
            let cmtPos = -1;
            let inString = false;
            for ( let i = 10; i < 80; ++i )
            {
               switch ( inputByteArray.at(i) )
               {
                  case 39: // single quote
                     inString ^= true;
                     break;
                  case 47: // slash
                     if ( (!inString) && (cmtPos == -1) )
                     cmtPos = i;
                     break;
               }
            }

            if ( cmtPos < 0 ) { cmtPos = 80; } // no comment separator

            //read value and comment
            fitsKeyword.value = inputByteArray.toString( 10, cmtPos - 10 ).trimRight();
            if ( cmtPos < 80 ) { fitsKeyword.comment = inputByteArray.toString( cmtPos + 1, 80 - cmtPos - 1 ).trimRight(); }
         }
         else
         {
            //if no value then just read comment
            fitsKeyword.comment = inputByteArray.toString( 8, 80 - 8 ).trimRight();
         }
      }

      return fitsKeyword;
   }



   this.extractFITSKeywords = function( inputFile )
   {
      let fitsKeywords = new Array
      let name = ""

      let f = new File;
      f.openForReading( inputFile );

      do
      {
         let rawData = f.read(DataType_ByteArray, 80);
         let fkw = this.ByteArrayToFITSKeyword(rawData);
         name = fkw.name.toUpperCase().trim();
         fitsKeywords.push( fkw );
      }
      while (name != "END")

      f.close();

      return fitsKeywords  //Note this will include the END keyword
   }
}





function isFITSEqual(f1, f2, nameOnly)
{
   let returnValue = true;
   if (f1.name.toUpperCase().trim() != f2.name.toUpperCase().trim()) { returnValue = false; }
   if (!nameOnly)
   {
      if (f1.value.toUpperCase().trim() != f2.value.toUpperCase().trim()) { returnValue = false; }
      if (f1.comment.toUpperCase().trim() != f2.comment.toUpperCase().trim()) { returnValue = false; }
   }
   return returnValue;
}







/*
 * Batch FITS keyword edit dialog
 */
function BatchFITSKeywordEditDialog( engine )
{
   this.__base__ = Dialog;
   this.__base__();

   this.engine = engine;

   //

   //let labelWidth1 = this.font.width( "Output format hints:" + 'T' );
   var labelWidth1 = this.font.width( "Modify output file name with:" );
   var commentWidth = 36 * this.font.width( "M" );
   this.textEditWidth = 25 * this.font.width( "M" );
   this.numericEditWidth = 6 * this.font.width( "0" );

   // Header label

   this.helpLabel = new Label( this );
   this.helpLabel.frameStyle = FrameStyle_Box;
   this.helpLabel.margin = this.logicalPixelsToPhysical( 4 );
   this.helpLabel.wordWrapping = true;
   this.helpLabel.useRichText = true;
   this.helpLabel.text = "<p><b>" + TITLE + " v" + VERSION + "</b> &mdash; "  +
                         "A batch utility to edit, add or remove a FITS keyword from a FITS file.</p>" +
                         "<p>Copyright &copy; 2021 Michael Cranfield</p>";


   // File input

   this.files_TreeBox = new TreeBox( this );
   this.files_TreeBox.multipleSelection = true;
   this.files_TreeBox.rootDecoration = false;
   this.files_TreeBox.alternateRowColor = true;
   this.files_TreeBox.setScaledMinSize( 500, 200 );
   this.files_TreeBox.numberOfColumns = 1;
   this.files_TreeBox.headerVisible = false;

   this.files_TreeBox.onNodeSelectionUpdated = function()
   {
      this.dialog.updateControls(true)
   }

   for ( let i = 0; i < this.engine.inputFiles.length; ++i )
   {
      let node = new TreeBoxNode( this.files_TreeBox );
      node.setText( 0, this.engine.inputFiles[i] );
   }

   this.filesAdd_Button = new PushButton( this );
   this.filesAdd_Button.text = "Add";
   this.filesAdd_Button.icon = this.scaledResource( ":/icons/add.png" );
   this.filesAdd_Button.toolTip = "<p>Add image files to the input images list.</p>";
   this.filesAdd_Button.onClick = function()
   {
      let ofd = new OpenFileDialog;
      ofd.multipleSelections = true;
      ofd.caption = "Select Images";
      ofd.loadImageFilters();

      if ( ofd.execute() )
      {
         this.dialog.files_TreeBox.canUpdate = false;
         for ( let i = 0; i < ofd.fileNames.length; ++i )
         {
            let node = new TreeBoxNode( this.dialog.files_TreeBox );
            node.setText( 0, ofd.fileNames[i] );
            this.dialog.engine.inputFiles.push( ofd.fileNames[i] );
         }
         this.dialog.files_TreeBox.canUpdate = true;
      }

      this.dialog.updateControls(true)
   };

   this.filesClear_Button = new PushButton( this );
   this.filesClear_Button.text = "Clear";
   this.filesClear_Button.icon = this.scaledResource( ":/icons/clear.png" );
   this.filesClear_Button.toolTip = "<p>Clear the list of input images.</p>";
   this.filesClear_Button.onClick = function()
   {
      this.dialog.files_TreeBox.clear();
      this.dialog.engine.inputFiles.length = 0;
      this.dialog.updateControls(true)
   };

   this.filesInvert_Button = new PushButton( this );
   this.filesInvert_Button.text = "Invert Selection";
   this.filesInvert_Button.icon = this.scaledResource( ":/icons/select-invert.png" );
   this.filesInvert_Button.toolTip = "<p>Invert the current selection of input images.</p>";
   this.filesInvert_Button.onClick = function()
   {
      for ( let i = 0; i < this.dialog.files_TreeBox.numberOfChildren; ++i )
         this.dialog.files_TreeBox.child( i ).selected =
               !this.dialog.files_TreeBox.child( i ).selected;
      this.dialog.updateControls(true)
   };

   this.filesRemove_Button = new PushButton( this );
   this.filesRemove_Button.text = "Remove Selected";
   this.filesRemove_Button.icon = this.scaledResource( ":/icons/delete.png" );
   this.filesRemove_Button.toolTip = "<p>Remove all selected images from the input images list.</p>";
   this.filesRemove_Button.onClick = function()
   {
      this.dialog.engine.inputFiles.length = 0;
      for ( let i = 0; i < this.dialog.files_TreeBox.numberOfChildren; ++i )
         if ( !this.dialog.files_TreeBox.child( i ).selected )
            this.dialog.engine.inputFiles.push( this.dialog.files_TreeBox.child( i ).text( 0 ) );
      for ( let i = this.dialog.files_TreeBox.numberOfChildren; --i >= 0; )
         if ( this.dialog.files_TreeBox.child( i ).selected )
            this.dialog.files_TreeBox.remove( i );
      this.dialog.updateControls(true)
   };

   this.filesButtons_Sizer = new HorizontalSizer;
   this.filesButtons_Sizer.spacing = 4;
   this.filesButtons_Sizer.add( this.filesAdd_Button );
   this.filesButtons_Sizer.addStretch();
   this.filesButtons_Sizer.add( this.filesClear_Button );
   this.filesButtons_Sizer.addStretch();
   this.filesButtons_Sizer.add( this.filesInvert_Button );
   this.filesButtons_Sizer.add( this.filesRemove_Button );

   this.files_GroupBox = new GroupBox( this );
   this.files_GroupBox.title = "Input Images";
   this.files_GroupBox.sizer = new VerticalSizer;
   this.files_GroupBox.sizer.margin = 6;
   this.files_GroupBox.sizer.spacing = 4;
   this.files_GroupBox.sizer.add( this.files_TreeBox, 100 );
   this.files_GroupBox.sizer.add( this.filesButtons_Sizer );


   //-----Add keyword-----elements

   this.addKeyword_Label = new Label( this )
   this.addKeyword_Label.text = "Keyword:";
   this.addKeyword_Label.minWidth = labelWidth1;
   this.addKeyword_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.addKeyword_Edit = new Edit( this );
   this.addKeyword_Edit.readOnly = false;
   this.addKeyword_Edit.text = engine.addKeyword;
   this.addKeyword_Edit.toolTip =
      "<p>Specifies the keyword to add.</p>";
   this.addKeyword_Edit.onEditCompleted = function() {
      engine.addKeyword = this.text.toUpperCase().trim();
   }

   this.addValue_Label = new Label( this )
   this.addValue_Label.text = "Value:";
   this.addValue_Label.minWidth = labelWidth1;
   this.addValue_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.addValue_Edit = new Edit( this );
   this.addValue_Edit.readOnly = false;
   this.addValue_Edit.text = engine.addValue;
   this.addValue_Edit.toolTip =
      "<p>Specifies the keyword value to add.</p>";
   this.addValue_Edit.onEditCompleted = function() {
      engine.addValue = this.text.trim();
   }

   this.addComment_Label = new Label( this )
   this.addComment_Label.text = "Comment:";
   this.addComment_Label.minWidth = labelWidth1;
   this.addComment_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.addComment_Edit = new Edit( this );
   this.addComment_Edit.readOnly = false;
   this.addComment_Edit.minWidth = commentWidth;
   this.addComment_Edit.text = engine.addComment;
   this.addComment_Edit.toolTip =
      "<p>Specifies the comment to add.</p>";
   this.addComment_Edit.onEditCompleted = function() {
      engine.addComment = this.text.trim();
   }

   this.addLocation_Label = new Label( this )
   this.addLocation_Label.text = "Keyword:";
   this.addLocation_Label.minWidth = labelWidth1;
   this.addLocation_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.addLocation_Combo = new ComboBox ( this );
   this.addLocation_Combo.minWidth = labelWidth1;
   this.addLocation_Combo.addItem("");
   this.addLocation_Combo.currentItem = 0;
   this.addLocation_Combo.toolTip =
      "<p>Specifies the keyword before or after which the new keyword " +
      "will be added.  Select a file from the InputImages list " +
      "to see the current keywords in that file.  Note that if you " +
      "try to add too early in the keyword list, Pixinsight my override.</p>";
   this.addLocation_Combo.onItemSelected = function( index )
   {
      engine.locationKeywordIndex = index;
   }

   this.addMatchName_Check = new CheckBox( this );
   this.addMatchName_Check.text = "Match name only";
   this.addMatchName_Check.checked = engine.addMatchName;
   this.addMatchName_Check.toolTip =
      "<p>Check here if add Location should only check the Keyword " +
      "name.  If different files in the batch have different values " +
      "for the desired add location keyword then check this box.</p>";
   this.addMatchName_Check.onCheck = function( checked )
   {
      engine.addMatchName = checked;
   }

   this.addBeforeAfter_Label = new Label( this );
   this.addBeforeAfter_Label.text = "Add new keyword:";
   this.addBeforeAfter_Label.minWidth = labelWidth1;
   this.addBeforeAfter_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;


   this.addBeforeAfter_Combo = new ComboBox( this );
   this.addBeforeAfter_Combo.addItem( "before" );
   this.addBeforeAfter_Combo.addItem( "after" );
   this.addBeforeAfter_Combo.currentItem = 0;
   if (engine.addBeforeAfter == "after") {  this.addBeforeAfter_Combo.currentItem = 1; }
   this.addBeforeAfter_Combo.toolTip =
       "<p>Specifies whether the new keyword should be written " +
       "before or after the locator keyword below.</p>";
   this.addBeforeAfter_Combo.onItemSelected = function( index )
   {
      engine.addBeforeAfter = this.itemText(index).trim();
   }

   this.addDuplicates_Label = new Label( this ) //Used to position duplicate checkbox
   this.addDuplicates_Label.text = "";
   this.addDuplicates_Label.minWidth = labelWidth1;
   this.addDuplicates_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.addDuplicates_Check = new CheckBox( this );
   this.addDuplicates_Check.text = "Allow duplicate keywords?";
   this.addDuplicates_Check.checked = engine.addDuplicates;
   this.addDuplicates_Check.toolTip =
      "<p>Check here if you want to allow your new keyword to duplicate an " +
      "existing keyword.  Note duplicate keywords other than COMMENT, " +
      "CONTINUE, or HISTORY keywords can lead to undefined behaviour.</p>";
   this.addDuplicates_Check.onCheck = function( checked )
   {
      engine.addDuplicates = checked;
      //console.writeln("addDuplicates = ", engine.addDuplicates);
   };

   //-----Add keyword-----sizers

   this.addKeyword_Sizer = new HorizontalSizer;
   this.addKeyword_Sizer.spacing = 4;
   this.addKeyword_Sizer.add( this.addKeyword_Label );
   this.addKeyword_Sizer.add( this.addKeyword_Edit );
   this.addKeyword_Sizer.addStretch();

   this.addValue_Sizer = new HorizontalSizer;
   this.addValue_Sizer.spacing = 4;
   this.addValue_Sizer.add( this.addValue_Label );
   this.addValue_Sizer.add( this.addValue_Edit );
   this.addValue_Sizer.addStretch();

   this.addComment_Sizer = new HorizontalSizer;
   this.addComment_Sizer.spacing = 4;
   this.addComment_Sizer.add( this.addComment_Label );
   this.addComment_Sizer.add( this.addComment_Edit );
   this.addComment_Sizer.addStretch();

   this.addBeforeAfter_Sizer = new HorizontalSizer;
   this.addBeforeAfter_Sizer.spacing = 4;
   this.addBeforeAfter_Sizer.add( this.addBeforeAfter_Label );
   this.addBeforeAfter_Sizer.add( this.addBeforeAfter_Combo );
   this.addBeforeAfter_Sizer.addStretch();

   this.addLocation_Sizer = new HorizontalSizer;
   this.addLocation_Sizer.spacing = 4;
   this.addLocation_Sizer.add( this.addLocation_Label );
   this.addLocation_Sizer.add( this.addLocation_Combo );
   this.addLocation_Sizer.add( this.addMatchName_Check );
   this.addLocation_Sizer.addStretch();

   this.addDuplicates_Sizer = new HorizontalSizer;
   this.addDuplicates_Sizer.spacing = 4;
   this.addDuplicates_Sizer.add( this.addDuplicates_Label );
   this.addDuplicates_Sizer.add( this.addDuplicates_Check );
   this.addDuplicates_Sizer.addStretch();

   //-----Add keyword-----section

   this.addKeywordSection = new Control(this);
   this.addKeywordSection.sizer = new VerticalSizer( this );
   this.addKeywordSection.sizer.spacing = 4;
   this.addKeywordSection.sizer.add( this.addKeyword_Sizer );
   this.addKeywordSection.sizer.add( this.addValue_Sizer );
   this.addKeywordSection.sizer.add( this.addComment_Sizer );
   this.addKeywordSection.sizer.add( this.addBeforeAfter_Sizer );
   this.addKeywordSection.sizer.add( this.addLocation_Sizer );
   this.addKeywordSection.sizer.add( this.addDuplicates_Sizer );

   this.addKeywordBar = new SectionBar(this, "Add keyword");
   this.addKeywordBar.enableCheckBox();
   this.addKeywordBar.setSection(this.addKeywordSection);
   this.addKeywordBar.checkBox.checked = true;
   this.addKeywordBar.checkBox.onCheck = function( checked )
   {
      engine.actionAdd = true;
      engine.actionEdit = false;
      engine.actionRemove = false;
      this.dialog.updateControls(false);
   }



   //-----Edit keyword-----elements

   this.editKeyword_Label = new Label( this )
   this.editKeyword_Label.text = "Keyword:";
   this.editKeyword_Label.minWidth = labelWidth1;
   this.editKeyword_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.editKeyword_Combo = new ComboBox ( this );
   this.editKeyword_Combo.minWidth = labelWidth1;
   this.editKeyword_Combo.addItem("");
   this.editKeyword_Combo.currentItem = 0;
   this.editKeyword_Combo.toolTip =
      "<p>Specifies the keyword to be edited.  Note that you may not edit " +
      "some keywords.  If you try to edit these Pixinsight will override.</p>";
   this.editKeyword_Combo.onItemSelected = function( index )
   {
      let newKwd = engine.keywordList[index];
      if (engine.editKeywordIndex != index)
      {
         engine.editValue = newKwd.value;
         this.dialog.editValue_Edit.text = engine.editValue;
         engine.editComment = newKwd.comment;
         this.dialog.editComment_Edit.text = engine.editComment;
      }
      engine.editKeywordIndex = index;
   }

   this.editMatchName_Check = new CheckBox( this );
   this.editMatchName_Check.text = "Match name only";
   this.editMatchName_Check.checked = engine.editMatchName;
   this.editMatchName_Check.toolTip =
      "<p>Check here if you only want to check the Keyword name. " +
      "If different files in the batch have different values " +
      "for the keyword you want to edit then check this box.</p>";
   this.editMatchName_Check.onCheck = function( checked )
   {
      engine.editMatchName = checked;
   }

   this.editValue_Label = new Label( this )
   this.editValue_Label.text = "Value:";
   this.editValue_Label.minWidth = labelWidth1;
   this.editValue_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.editValue_Edit = new Edit( this );
   this.editValue_Edit.readOnly = false;
   this.editValue_Edit.text = engine.editValue;
   this.editValue_Edit.toolTip =
      "<p>Specifies the new value for the keyword to be edited.</p>";
   this.editValue_Edit.onEditCompleted = function() {
      engine.editValue = this.text.trim();
   }

   this.editComment_Label = new Label( this )
   this.editComment_Label.text = "Comment:";
   this.editComment_Label.minWidth = labelWidth1;
   this.editComment_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.editComment_Edit = new Edit( this );
   this.editComment_Edit.readOnly = false;
   this.editComment_Edit.text = engine.editComment;
   this.editComment_Edit.minWidth = commentWidth;
   this.editComment_Edit.toolTip =
      "<p>Specifies the new comment for the keyword to be edited.</p>";
   this.editComment_Edit.onEditCompleted = function() {
      engine.editComment = this.text.trim();
   }

   //-----Edit keyword-----sizers

   this.editKeyword_Sizer = new HorizontalSizer;
   this.editKeyword_Sizer.spacing = 4;
   this.editKeyword_Sizer.add( this.editKeyword_Label );
   this.editKeyword_Sizer.add( this.editKeyword_Combo );
   this.editKeyword_Sizer.add( this.editMatchName_Check );
   this.editKeyword_Sizer.addStretch();

   this.editValue_Sizer = new HorizontalSizer;
   this.editValue_Sizer.spacing = 4;
   this.editValue_Sizer.add( this.editValue_Label );
   this.editValue_Sizer.add( this.editValue_Edit );
   this.editValue_Sizer.addStretch();

   this.editComment_Sizer = new HorizontalSizer;
   this.editComment_Sizer.spacing = 4;
   this.editComment_Sizer.add( this.editComment_Label );
   this.editComment_Sizer.add( this.editComment_Edit );
   this.editComment_Sizer.addStretch();

   //-----Edit keyword-----section

   this.editKeywordSection = new Control(this);
   this.editKeywordSection.sizer = new VerticalSizer;
   this.editKeywordSection.sizer.spacing = 4;
   this.editKeywordSection.sizer.add( this.editKeyword_Sizer );
   this.editKeywordSection.sizer.add( this.editValue_Sizer );
   this.editKeywordSection.sizer.add( this.editComment_Sizer );



   this.editKeywordBar = new SectionBar(this, "Edit keyword");
   this.editKeywordBar.enableCheckBox();
   this.editKeywordBar.setSection(this.editKeywordSection);
   this.editKeywordBar.checkBox.onCheck = function( checked )
   {
      engine.actionAdd = false;
      engine.actionEdit = true;
      engine.actionRemove = false;
      this.dialog.updateControls(false);
   }
   this.editKeywordBar.updateSection();


   //-----Remove keyword-----elements

   this.removeKeyword_Label = new Label( this )
   this.removeKeyword_Label.text = "Keyword:";
   this.removeKeyword_Label.minWidth = labelWidth1;
   this.removeKeyword_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.removeKeyword_Combo = new ComboBox ( this );
   this.removeKeyword_Combo.minWidth = labelWidth1;
   this.removeKeyword_Combo.addItem("");
   this.removeKeyword_Combo.currentItem = 0;
   this.removeKeyword_Combo.toolTip =
      "<p>Specifies the keyword to be removed.  Note that you may not remove " +
      "some keywords.  If you try to remove these Pixinsight will override.</p>";
   this.removeKeyword_Combo.onItemSelected = function( index )
   {
      let newKwd = engine.keywordList[index];
      engine.removeValue = newKwd.value;
      this.dialog.removeValue_Label2.text = engine.removeValue;
      engine.removeComment = newKwd.comment;
      this.dialog.removeComment_Label2.text = engine.removeComment;
      engine.removeKeywordIndex = index;
   }

   this.removeMatchName_Check = new CheckBox( this );
   this.removeMatchName_Check.text = "Match name only";
   this.removeMatchName_Check.checked = engine.removeMatchName;
   this.removeMatchName_Check.toolTip =
      "<p>Check here if only want to check the Keyword name. " +
      "If different files in the batch have different values " +
      "for the keyword you want to remove then check this box.</p>";
   this.removeMatchName_Check.onCheck = function( checked )
   {
      engine.removeMatchName = checked;
   }

   this.removeValue_Label1 = new Label( this )
   this.removeValue_Label1.text = "Value:";
   this.removeValue_Label1.minWidth = labelWidth1;
   this.removeValue_Label1.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.removeValue_Label2 = new Label( this );
   this.removeValue_Label2.text = engine.removeValue;
   this.removeValue_Label2.minWidth = labelWidth1;
   this.removeValue_Label2.textAlignment = TextAlign_Right|TextAlign_VertCenter;


   this.removeComment_Label1 = new Label( this )
   this.removeComment_Label1.text = "Comment:";
   this.removeComment_Label1.minWidth = labelWidth1;
   this.removeComment_Label1.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.removeComment_Label2 = new Label( this )
   this.removeComment_Label2.text = engine.removeComment;
   this.removeComment_Label2.minWidth = commentWidth;
   this.removeComment_Label2.textAlignment = TextAlign_Left|TextAlign_VertCenter;

   //-----Remove keyword-----sizers

   this.removeKeyword_Sizer = new HorizontalSizer;
   this.removeKeyword_Sizer.spacing = 4;
   this.removeKeyword_Sizer.add( this.removeKeyword_Label );
   this.removeKeyword_Sizer.add( this.removeKeyword_Combo );
   this.removeKeyword_Sizer.add( this.removeMatchName_Check );
   this.removeKeyword_Sizer.addStretch();

   this.removeValue_Sizer = new HorizontalSizer;
   this.removeValue_Sizer.spacing = 4;
   this.removeValue_Sizer.add( this.removeValue_Label1 );
   this.removeValue_Sizer.add( this.removeValue_Label2 );
   this.removeValue_Sizer.addStretch();

   this.removeComment_Sizer = new HorizontalSizer;
   this.removeComment_Sizer.spacing = 4;
   this.removeComment_Sizer.add( this.removeComment_Label1 );
   this.removeComment_Sizer.add( this.removeComment_Label2 );
   this.removeComment_Sizer.addStretch();

   //-----Remove keyword-----section

   this.removeKeywordSection = new Control(this);
   this.removeKeywordSection.sizer = new VerticalSizer;
   this.removeKeywordSection.sizer.spacing = 4;
   this.removeKeywordSection.sizer.add( this.removeKeyword_Sizer );
   this.removeKeywordSection.sizer.add( this.removeValue_Sizer );
   this.removeKeywordSection.sizer.add( this.removeComment_Sizer );



   this.removeKeywordBar = new SectionBar(this, "Remove keyword");
   this.removeKeywordBar.enableCheckBox();
   this.removeKeywordBar.setSection(this.removeKeywordSection);
   this.removeKeywordBar.checkBox.onCheck = function( checked )
   {
      engine.actionAdd = false;
      engine.actionEdit = false;
      engine.actionRemove = true;
      this.dialog.updateControls(false);
   }


   this.updateControls = function(updateKeywordList)
   {

      this.dialog.addKeywordBar.checkBox.checked = engine.actionAdd;
      this.dialog.editKeywordBar.checkBox.checked = engine.actionEdit;
      this.dialog.removeKeywordBar.checkBox.checked = engine.actionRemove;

      this.dialog.addKeywordBar.section.enabled = engine.actionAdd;
      this.dialog.editKeywordBar.section.enabled = engine.actionEdit;
      this.dialog.removeKeywordBar.section.enabled = engine.actionRemove;




      if (updateKeywordList)  //We have arrived here from a change to the file list
      {
         let fileName = "";
         if (this.dialog.files_TreeBox.selectedNodes.length != 0)
         {
            fileName = this.dialog.files_TreeBox.selectedNodes[0].text(0);
         }
         else
         {
            if (this.dialog.files_TreeBox.numberOfChildren > 0)
            {
               fileName = this.dialog.files_TreeBox.child(0).text(0);
            }
         }


         let currentLocationKeyword = this.dialog.engine.addLocation();
         let currentEditKeyword = this.dialog.engine.editKeyword();
         let currentRemoveKeyword = this.dialog.engine.removeKeyword();

         this.dialog.addLocation_Combo.clear();
         this.dialog.editKeyword_Combo.clear();
         this.dialog.removeKeyword_Combo.clear();

         engine.keywordList.length = 0;
         engine.locationKeywordIndex = -1;
         engine.editKeywordIndex = -1;
         engine.removeKeywordIndex = -1;

         let extractedFITSKeywords = new Array( new FITSKeyword("","","") );
         let firstUsable = 0;
         let lengthExclEND = 1;
         if (fileName != "")
         {
            extractedFITSKeywords.length = 0;
            extractedFITSKeywords = this.dialog.engine.extractFITSKeywords(fileName);
            let naxisCount = extractedFITSKeywords[2].value
            firstUsable = 3 + naxisCount.toInt();
            lengthExclEND = extractedFITSKeywords.length - 1;
         }

         for ( let i = firstUsable; i < lengthExclEND; ++i )
         {
            engine.keywordList.push(extractedFITSKeywords[i]);
            this.dialog.addLocation_Combo.addItem(extractedFITSKeywords[i].name);
            this.dialog.editKeyword_Combo.addItem(extractedFITSKeywords[i].name);
            this.dialog.removeKeyword_Combo.addItem(extractedFITSKeywords[i].name);

            if (isFITSEqual(extractedFITSKeywords[i], currentLocationKeyword, this.dialog.engine.addMatchName))
            {
               engine.locationKeywordIndex = i - firstUsable;
            }

            if (isFITSEqual(extractedFITSKeywords[i], currentEditKeyword, this.dialog.engine.editMatchName))
            {
               engine.editKeywordIndex = i - firstUsable;
            }

            if (isFITSEqual(extractedFITSKeywords[i], currentRemoveKeyword, this.dialog.engine.removeMatchName))
            {
               engine.removeKeywordIndex = i - firstUsable;
            }
         }

         if (engine.locationKeywordIndex < 0)
         {
            engine.locationKeywordIndex = 0;
         }
         this.dialog.addLocation_Combo.currentItem = engine.locationKeywordIndex;

         if (engine.editKeywordIndex < 0)
         {
            engine.editKeywordIndex = 0;
            engine.editValue = engine.editKeyword().value;
            this.dialog.editValue_Edit.text = engine.editValue;
            engine.editComment = engine.editKeyword().comment;
            this.dialog.editComment_Edit.text = engine.editComment;
         }
         this.dialog.editKeyword_Combo.currentItem = engine.editKeywordIndex;

         if (engine.removeKeywordIndex < 0)
         {
            engine.removeKeywordIndex = 0;
         }
         engine.removeValue = engine.removeKeyword().value;
         this.dialog.removeValue_Label2.text = engine.removeValue;
         engine.removeComment = engine.removeKeyword().comment;
         this.dialog.removeComment_Label2.text = engine.removeComment;
         this.dialog.removeKeyword_Combo.currentItem = engine.removeKeywordIndex;

      }


   }


   this.inputParameter_GroupBox = new GroupBox;
   this.inputParameter_GroupBox.title = "Keyword change parameters";
   this.inputParameter_GroupBox.sizer = new  VerticalSizer;
   this.inputParameter_GroupBox.sizer.margin = 6;
   this.inputParameter_GroupBox.sizer.spacing = 4;
   this.inputParameter_GroupBox.sizer.add( this.addKeywordBar );
   this.inputParameter_GroupBox.sizer.add( this.addKeywordSection );
   this.inputParameter_GroupBox.sizer.addSpacing(4);
   this.inputParameter_GroupBox.sizer.add( this.editKeywordBar );
   this.inputParameter_GroupBox.sizer.add( this.editKeywordSection );
   this.inputParameter_GroupBox.sizer.addSpacing(4);
   this.inputParameter_GroupBox.sizer.add( this.removeKeywordBar );
   this.inputParameter_GroupBox.sizer.add( this.removeKeywordSection );

   this.editKeywordSection.hide();
   this.removeKeywordSection.hide();

   this.updateControls(true);





    // Output

   this.outputDir_Edit = new Edit( this );
   this.outputDir_Edit.readOnly = true;
   this.outputDir_Edit.text = engine.outputDirectory;
   this.outputDir_Edit.toolTip =
      "<p>If specified, all converted images will be written to the output directory.</p>" +
      "<p>If not specified, converted images will be written to the same directories " +
      "as their corresponding input images.</p>";

   this.outputDirSelect_Button = new ToolButton( this );
   this.outputDirSelect_Button.icon = this.scaledResource( ":/browser/select-file.png" );
   this.outputDirSelect_Button.setScaledFixedSize( 20, 20 );
   this.outputDirSelect_Button.toolTip = "<p>Select the output directory.</p>";
   this.outputDirSelect_Button.onClick = function()
   {
      var gdd = new GetDirectoryDialog;
      gdd.initialPath = engine.outputDirectory;
      gdd.caption = "Select Output Directory";

      if ( gdd.execute() )
      {
         engine.outputDirectory = gdd.directory;
         this.dialog.outputDir_Edit.text = engine.outputDirectory;
      }
   };

   this.outputDir_Label = new Label( this );
   this.outputDir_Label.text = "Output Directory:";
   this.outputDir_Label.minWidth = labelWidth1;
   this.outputDir_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.outputDir_Sizer = new HorizontalSizer;
   this.outputDir_Sizer.spacing = 4;
   this.outputDir_Sizer.add( this.outputDir_Label );
   this.outputDir_Sizer.add( this.outputDir_Edit, this.textEditWidth );
   this.outputDir_Sizer.add( this.outputDirSelect_Button );

   this.outputPrefix_Label = new Label (this);
   this.outputPrefix_Label.text = "Prefix:";
   this.outputPrefix_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.outputPrefix_Edit = new Edit( this );
   this.outputPrefix_Edit.text = engine.outputPrefix;
   this.outputPrefix_Edit.setFixedWidth( this.font.width( "MMMMMM" ) );
   this.outputPrefix_Edit.toolTip = "Text to add to the start of the output file name";
   this.outputPrefix_Edit.onEditCompleted = function()
   {
      engine.outputPrefix = this.text;
   };

   this.outputPostfix_Label = new Label (this);
   this.outputPostfix_Label.text = "Postfix:";
   this.outputPostfix_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.outputPostfix_Edit = new Edit( this );
   this.outputPostfix_Edit.text = engine.outputPostfix;
   this.outputPostfix_Edit.setFixedWidth( this.font.width( "MMMMMM" ) );
   this.outputPostfix_Edit.toolTip = "Text to append to the end of the output file name";
   this.outputPostfix_Edit.onEditCompleted = function()
   {
      engine.outputPostfix = this.text;
   };

   this.outputFileName_Label = new Label( this );
   this.outputFileName_Label.text = "Modify output file name with: ";
   this.outputFileName_Label.minWidth = labelWidth1;
   this.outputFileName_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

   this.options_Sizer = new HorizontalSizer;
   this.options_Sizer.spacing = 4;
   this.options_Sizer.add( this.outputFileName_Label );
   //this.options_Sizer.add( this.outputExt_Edit );
   this.options_Sizer.addSpacing( 8 );
   this.options_Sizer.add( this.outputPrefix_Label );
   this.options_Sizer.add( this.outputPrefix_Edit );
   this.options_Sizer.addSpacing( 8 );
   this.options_Sizer.add( this.outputPostfix_Label );
   this.options_Sizer.add( this.outputPostfix_Edit );
   this.options_Sizer.addStretch();

   this.outputOptions_GroupBox = new GroupBox( this );
   this.outputOptions_GroupBox.title = "Output File Options";
   this.outputOptions_GroupBox.sizer = new VerticalSizer;
   this.outputOptions_GroupBox.sizer.margin = 6;
   this.outputOptions_GroupBox.sizer.spacing = 4;
   this.outputOptions_GroupBox.sizer.add( this.options_Sizer );
   //this.outputOptions_GroupBox.sizer.add( this.overwriteExisting_Sizer );
   this.outputOptions_GroupBox.sizer.add( this.outputDir_Sizer );



   // OK/Cancel Buttons

   this.ok_Button = new PushButton( this );
   this.ok_Button.text = "OK";
   this.ok_Button.icon = this.scaledResource( ":/icons/ok.png" );
   this.ok_Button.onClick = function()
   {
      this.dialog.ok();
   };

   this.cancel_Button = new PushButton( this );
   this.cancel_Button.text = "Cancel";
   this.cancel_Button.icon = this.scaledResource( ":/icons/cancel.png" );
   this.cancel_Button.onClick = function()
   {
      this.dialog.cancel();
   };

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 6;
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add( this.ok_Button );
   this.buttons_Sizer.add( this.cancel_Button );



   // Dialog layout

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add( this.helpLabel );
   this.sizer.addSpacing( 4 );
   this.sizer.add( this.files_GroupBox, 100 );
   this.sizer.add( this.inputParameter_GroupBox );
   this.sizer.add( this.outputOptions_GroupBox );
   this.sizer.add( this.buttons_Sizer );

   this.windowTitle = TITLE + " Script";
   this.userResizable = true;
   this.adjustToContents();




}


// Our dialog inherits all properties and methods from the core Dialog object.
BatchFITSKeywordEditDialog.prototype = new Dialog;

/*
 * Script entry point.
 */
function main()
{
   //console.hide();

   let engine = new BatchFITSKeywordEditEngine;

   for ( let dialog = new BatchFITSKeywordEditDialog( engine ); ; )
   {
      if ( !dialog.execute() )
         break;

      if ( engine.inputFiles.length == 0 )
      {
         (new MessageBox( "No input files have been specified.", TITLE, StdIcon_Error, StdButton_Ok )).execute();
         continue;
      }

#ifneq WARN_ON_NO_OUTPUT_DIRECTORY 0
      if ( engine.outputDirectory.length == 0 )
         if ( (new MessageBox( "<p>No output directory has been specified.</p>" +
                               "<p>Each converted image will be written to the directory of " +
                               "its corresponding input file.<br>" +
                               "<b>Are you sure?</b></p>",
                               TITLE, StdIcon_Warning, StdButton_Yes, StdButton_No )).execute() != StdButton_Yes )
            continue;
#endif
      // Perform batch FITS file update and quit.
      console.show();
      console.abortEnabled = true;
      engine.processFiles();

      if ( (new MessageBox( "Do you want to amend additional FITS keywords?",
                            TITLE, StdIcon_Question, StdButton_Yes, StdButton_No )).execute() != StdButton_Yes )
         break;
   }
}

main();

// ----------------------------------------------------------------------------
// EOF BatchFITSKeywordEdit.js - Released 14/09/2021
