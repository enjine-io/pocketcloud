define("ace/theme/dark",["require","exports","module","ace/lib/dom"], function(require, exports, module) {

exports.isDark = true;
exports.cssClass = "ace-dark";
exports.cssText = ".ace-dark .ace_gutter {\
background: #25282c;\
color: #C5C8C6\
}\
.ace-dark .ace_print-margin {\
width: 1px;\
background: #25282c\
}\
.ace-dark {\
background-color: #1D1F21;\
color: #C5C8C6\
}\
.ace-dark .ace_cursor {\
color: #AEAFAD\
}\
.ace-dark .ace_marker-layer .ace_selection {\
background: #3333aa\
}\
.ace-dark.ace_multiselect .ace_selection.ace_start {\
box-shadow: 0 0 3px 0px #1D1F21;\
}\
.ace-dark .ace_marker-layer .ace_step {\
background: rgb(102, 82, 0)\
}\
.ace-dark .ace_marker-layer .ace_bracket {\
margin: -1px 0 0 -1px;\
border: 1px solid #4B4E55\
}\
.ace-dark .ace_marker-layer .ace_active-line {\
background: #303333\
}\
.ace-dark .ace_gutter-active-line {\
background-color: #282A2E\
}\
.ace-dark .ace_error-marker {\
background-color: rgba(255, 0, 0,0.7);\
position: absolute;\
z-index: 9;\
}\
.ace-dark .ace_marker-layer .ace_selected-word {\
border: 1px solid #3333ff\
}\
.ace-dark .ace_invisible {\
color: #4B4E55\
}\
.ace-dark .ace_keyword,\
.ace-dark .ace_meta,\
.ace-dark .ace_storage,\
.ace-dark .ace_storage.ace_type,\
.ace-dark .ace_support.ace_type {\
color: #8888ff\
}\
.ace-dark .ace_keyword.ace_operator {\
color: #cccccc\
}\
.ace-dark .ace_constant.ace_character,\
.ace-dark .ace_constant.ace_language,\
.ace-dark .ace_constant.ace_numeric,\
.ace-dark .ace_keyword.ace_other.ace_unit,\
.ace-dark .ace_support.ace_constant,\
.ace-dark .ace_variable.ace_parameter {\
color: #cc66dd\
}\
.ace-dark .ace_constant.ace_other {\
color: #CED1CF\
}\
.ace-dark .ace_invalid {\
color: #CED2CF;\
background-color: #DF5F5F\
}\
.ace-dark .ace_invalid.ace_deprecated {\
color: #CED2CF;\
background-color: #B798BF\
}\
.ace-dark .ace_fold {\
background-color: #81A2BE;\
border-color: #C5C8C6\
}\
.ace-dark .ace_entity.ace_name.ace_function,\
.ace-dark .ace_support.ace_function,\
.ace-dark .ace_variable {\
color: #cccccc;\
}\
.ace-dark .ace_support.ace_class,\
.ace-dark .ace_support.ace_type {\
color: #F0C674\
}\
.ace-dark .ace_heading,\
.ace-dark .ace_markup.ace_heading,\
.ace-dark .ace_string {\
color: #B5BD68\
}\
.ace-dark .ace_entity.ace_name.ace_tag,\
.ace-dark .ace_entity.ace_other.ace_attribute-name,\
.ace-dark .ace_meta.ace_tag,\
.ace-dark .ace_string.ace_regexp,\
.ace-dark .ace_variable {\
color: #CC6666\
}\
.ace-dark .ace_comment {\
color: #669966\
}\
.ace-dark .ace_indent-guide {\
background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWNgYGBgYHB3d/8PAAOIAdULw8qMAAAAAElFTkSuQmCC) right repeat-y\
}";

var dom = require("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
