/*
 *  $Id$
 *
 *  This file is part of the OpenLink Software Ajax Toolkit (OAT) project.
 *
 *  Copyright (C) 2005-2007 OpenLink Software
 *
 *  See LICENSE file for details.
 */

/*
	f = new OAT.Fresnel();
	f.addURL("fresnel-resource-url",callback)
	[div, stylesheetsArray] = f.format(RDFDataObject);
*/
 
OAT.Fresnel = function(optObj) {
	var self = this;
	this.options = {
		ajaxStart:false,
		ajaxEnd:false
	}
	for (var p in optObj) { self.options[p] = optObj[p]; }
	this.callback = false;
	this.ns = "http://www.w3.org/2004/09/fresnel#";
	
	self.data = {};
	self.data.lenses = [];
	self.data.formats = [];
	self.data.groups = [];

	this.storeLoaded = function() {	/* create shortcuts to groups, lenses and formats */
		self.data = {};
		self.data.lenses = [];
		self.data.formats = [];
		self.data.groups = [];
		var gns = self.ns+"group";
		for (var i=0;i<self.store.data.all.length;i++) {
			var item = self.store.data.all[i];
			if (item.type == self.ns+"Lens") { self.data.lenses.push(item); }
			if (item.type == self.ns+"Format") { self.data.formats.push(item); }
			if (item.type == self.ns+"Group") { self.data.groups.push(item); }
		}
		
		for (var i=0;i<self.data.lenses.length;i++) { /* each lens has shortcuts to groups */
			var lens = self.data.lenses[i];
			lens.groups = [];
			if (gns in lens.preds) {
				lens.groups = lens.preds[gns];
			}
		}

		for (var i=0;i<self.data.groups.length;i++) { /* each group has shortcuts to formats */
			var group = self.data.groups[i];
			group.formats = [];
		}

		for (var i=0;i<self.data.formats.length;i++) { /* each format has shortcuts to groups */
			var format = self.data.formats[i];
			format.groups = [];
			if (gns in format.preds) {
				var groups = format.preds[gns];
				format.groups = groups; 
				for (var j=0;j<groups.length;j++) { groups[j].formats.push(format); }
			}
		}

		if (self.callback) { self.callback(); } 
	}
	this.store = new OAT.RDFStore(self.storeLoaded,self.options);
	
	this.addURL = function(url,callback) {
		self.callback = callback;
		self.store.addURL(url);
	}
	
	/* -------------------- formatting detection ---------- */
	
	this.findGFResource = function(item,lens,use) { /* find groups and format for a resource */
		var groups = [];
		var format_class = false;
		var format_instance = false;
		
		groups.append(lens.groups);
		if (use) { groups.append(use); }
		
		var classNS = self.ns+"classFormatDomain";
		var instanceNS = self.ns+"instanceFormatDomain";
		for (var i=0;i<groups.length;i++) {
			var g = groups[i];
			if (g.formats) for (var j=0;j<g.formats.length;j++) {
				var f = g.formats[j];
				
				if (classNS in f.preds && f.preds[classNS].find(item.type) != -1) { format_class = f; }
				if (instanceNS in f.preds && f.preds[instanceNS].find(item.uri) != -1) { format_instance = f; }
			}
		}

		var f = false;
		if (format_class) { f = format_class; }
		if (format_instance) { f = format_instance; }
		
		return [groups,f];
	}
	
	this.findGFProperty = function(lens,property,use) {
		var groups = [];
		var format = false;
		var format_instance = false;
		
		groups.append(lens.groups);
		if (use) { groups.append(use); }
		var ns = self.ns+"propertyFormatDomain";
		for (var i=0;i<groups.length;i++) {
			var g = groups[i];
			if (g.formats) for (var j=0;j<g.formats.length;j++) {
				var f = g.formats[j];
				if (ns in f.preds) {
					if (f.preds[ns].find(property) != -1 || f.preds[ns].find(self.ns+"allProperties") != -1) { format = f; }
				}	
			}
		}
		return [groups,format];
	}
	
	/* -------------------- styling subs ------------------ */
	
	this.styleBox = function(box,list,property,format,counter) {
		var pre = false;
		var post = false;
		for (var i=0;i<list.length;i++) {
			var tmp = list[i];
			if (self.ns+"stylesheetLink" in tmp.preds) {
				var values = tmp.preds[self.ns+"stylesheetLink"];
				for (var j=0;j<values.length;j++) {
					var s = values[j];
					if (self.stylesheets.find(s) == -1) { self.stylesheets.push(s); }
				}
			}
			if (property in tmp.preds) {
				var values = tmp.preds[property];
				for (var j=0;j<values.length;j++) {
					var value = values[j];
					if (value.match(/:/)) {
						var s = box.getAttribute("style") || "";
						s += value+" ";
						box.setAttribute("style",s);
					} else {
						OAT.Dom.addClass(box,value);
					}
				} /* for all values */
			} /* if correct property */
			if (format in tmp.preds) {
				var obj = tmp.preds[format][0];
				if (self.ns+"contentBefore" in obj.preds) {	
					pre = OAT.Dom.create("span");
					pre.innerHTML = obj.preds[self.ns+"contentBefore"];	
				}
				if (self.ns+"contentAfter" in obj.preds) { 
					post = OAT.Dom.create("span");
					post.innerHTML = obj.preds[self.ns+"contentAfter"];	
				}
				if (self.ns+"contentFirst" in obj.preds && counter && counter[0] == 0) {
					pre = OAT.Dom.create("span");
					pre.innerHTML = obj.preds[self.ns+"contentFirst"];	
				}
				if (self.ns+"contentLast" in obj.preds && counter && counter[0]+1 == counter[1]) {
					post = OAT.Dom.create("span");
					post.innerHTML = obj.preds[self.ns+"contentLast"];	
				}
			} /* if correct property */
		} /* for all formatting objects */
		var result = [];
		if (pre) { result.push(pre); }
		result.push(box);
		if (post) { result.push(post); }
		return result;
	}
	
	this.styleProperty = function(box,lens,property,use) {
		var tmp = self.findGFProperty(lens,property,use);
		var list = tmp[0];
		if (tmp[1]) { list.push(tmp[1]); }
		return self.styleBox(box,list,self.ns+"propertyStyle",self.ns+"propertyFormat");
	}
	
	this.styleLabel = function(box,lens,property,use) { /* if available, include label */
		var tmp = self.findGFProperty(lens,property,use);
		var label = OAT.Dom.create("span",{},"fresnel_label");
		label.innerHTML = self.store.simplify(property);
		var list = tmp[0];
		if (tmp[1]) { list.push(tmp[1]); }
//		if (self.store.simplify(property) == "knows") window.cica = list;
		var result = self.styleBox(label,list,self.ns+"labelStyle");
		for (var i=0;i<list.length;i++) {
			var tmp = list[i];
			if (self.ns+"label" in tmp.preds) {
				var val = tmp.preds[self.ns+"label"][0];
				if (val == self.ns+"none") { label = false; }
				else if (val == self.ns+"show") {}
				else { label.innerHTML = val; }
			}
		}
		if (label) { OAT.Dom.append([box,result]); }
	}

	this.styleValue = function(box,lens,property,use,counter) {
		var tmp = self.findGFProperty(lens,property,use);
		var list = tmp[0];
		if (tmp[1]) { list.push(tmp[1]); }
		return self.styleBox(box,list,self.ns+"valueStyle",self.ns+"valueFormat",counter);
	}

	this.styleResource = function(container,box,item,lens,use) {
		var tmp = self.findGFResource(item,lens,use);
		var list = tmp[0];
		if (tmp[1]) { list.push(tmp[1]); }
		self.styleBox(container,list,self.ns+"containerStyle");
		return self.styleBox(box,list,self.ns+"resourceStyle",self.ns+"resourceFormat");
	}
	
	/* ------------------- main routines ----------------- */
	
	this.findLens = function(item) { /* find appropriate lens for this resource */
		var l_class = false;
		var d_class = false;
		var l_instance = false;
		var d_instance = false;
		for (var i=0;i<self.data.lenses.length;i++) {
			var lens = self.data.lenses[i];
			var ok_class = false;
			var ok_instance = false;
			var purpose = "";
			if (self.ns+"purpose" in lens.preds) { purpose = lens.preds[self.ns+"purpose"][0]; }
			if (self.ns+"classLensDomain" in lens.preds) { ok_class = (lens.preds[self.ns+"classLensDomain"].find(item.type) != -1); }
			if (self.ns+"classInstanceDomain" in lens.preds) { ok_instance = (lens.preds[self.ns+"classInstanceDomain"].find(item.uri) != -1); }

			if (ok_class) {
				if (purpose == self.ns+"defaultLens") { d_class = lens; } else { l_class = lens; }
			}
			if (ok_instance) {
				if (purpose == self.ns+"defaultLens") { d_instance = lens; } else { l_instance = lens; }
			}
		}
		if (d_instance) { return d_instance; }
		if (d_class) { return d_class; }
		if (l_instance) { return l_instance; }
		if (l_class) { return l_class; }
		return false;
	}

	this.formatProperty = function(parent,item,lens,property,sublens,use) { /* add this property to resource's box */
		var box = OAT.Dom.create("div",{},"fresnel_property");
		var htmlElements = self.styleProperty(box,lens,property,use);
		
		self.styleLabel(box,lens,property,use);
		var values = item.preds[property];
		self.formatContainer(box,values,property,(sublens ? sublens : lens),use);
		
		OAT.Dom.append([parent,htmlElements]);
	}
	
	this.formatProperties = function(parent,item,lens,use1) { /* add (some?) properties to resource's box */
		var showProps = [];
		var hideProps = [];
		var usedProps = []; /* store used properties */
		if (self.ns+"showProperties" in lens.preds) { showProps = lens.preds[self.ns+"showProperties"]; }
		if (self.ns+"hideProperties" in lens.preds) { hideProps = lens.preds[self.ns+"hideProperties"]; }

		if (!showProps.length) { return; } /* no displayable properties for this resource?!? */
		var all = false; /* show all? */
		for (var i=0;i<showProps.length;i++) {
			var property = showProps[i];
			var pname = property;
			var sublens = false;
			var depth = -1;
			var use2 = [];
			if (typeof(property) == "object") { /* analyze object */
				if (self.ns+"use" in property.preds) { use2 = property.preds[use]; }
				if (self.ns+"property" in property.preds) { pname = property.preds[self.ns+"property"][0]; }
				if (self.ns+"sublens" in property.preds) { sublens = property.preds[self.ns+"sublens"][0]; }
				if (self.ns+"depth" in property.preds) { depth = parseInt(property.preds[self.ns+"depth"][0]); }
			}
			var use = [];
			if (use1) { use.append(use1); }
			if (use2) { use.append(use2); }
			if (!use.length) { use = false; }
			if (pname == self.ns + "allProperties") { all = true; }
			if (!(pname in item.preds)) { continue; }
			if (depth != -1 && self.depth > depth) { continue; }
			if (sublens) { self.depth++; }
			self.formatProperty(parent,item,lens,pname,sublens,use);
			if (sublens) { self.depth--; }
			usedProps.push(property);
		}
		
		if (all) { /* all remaining */
			for (var p in item.preds) {
				if (usedProps.find(p) == -1 && hideProps.find(p) == -1) {
					self.formatProperty(parent,item,lens,p);
				}
			}
		}
	}
	
	this.formatValue = function(parent,pair,property,counter,use) { /* add value to container: resource or simple value */
		var item = pair[0];
		var lens = pair[1];
		var box = false;
		
		if (typeof(item) == "object") {
			box = OAT.Dom.create("div",{},"fresnel_value");
			self.formatResource(box,pair,use);
		} else {
			var value = false;
			var tmp = self.findGFProperty(lens,property,use);
			var list = tmp[0];
			if (tmp[1]) { list.push(tmp[1]); }
			for (var i=0;i<list.length;i++) {
				var tmp = list[i];
				if (self.ns+"value" in tmp.preds) { value = tmp.preds[self.ns+"value"][0]; }
			}
			if (value == self.ns+"uri" || value == self.ns+"externalLink" || value == self.ns+"replacedResource") {
				box = OAT.Dom.create("a",{},"fresnel_value");
				box.innerHTML = item;
				box.href = item;
			} else if (value == self.ns+"image") {
				box = OAT.Dom.create("img");
				box.src = item;
			} else {
				box = OAT.Dom.create("span",{},"fresnel_value");
				box.innerHTML = item;
			}
		}
		var htmlElements = self.styleValue(box,lens,property,use,counter);
		OAT.Dom.append([parent,htmlElements]);
	}
	
	this.formatResource = function(parent,pair,use) { /* add resource to container */
		var item = pair[0];
		var lens = pair[1];
		var box = OAT.Dom.create("div",{},"fresnel_resource");
		var htmlElements = self.styleResource(parent,box,item,lens,use);
		self.formatProperties(box,item,lens,use); /* add all these properties */
		OAT.Dom.append([parent,htmlElements]);
	}
	
	this.formatItem = function(parent,pair,property,counter,use) { /* add something to container */
		if (property) { /* these items are values of some property */
			self.formatValue(parent,pair,property,counter,use);
		} else { /* these items are top-level resources */
			self.formatResource(parent,pair,use)
		}
	}

	this.formatContainer = function(parent,data,property,lens,use) { /* container */
		var list = [];
		for (var i=0;i<data.length;i++) {
			var item = data[i];
			if (typeof(item) == "object") {
				if (lens) {
					list.push([item,lens]);
				} else {
					var l = self.findLens(item);
					if (l) { list.push([item,l]); }
				}
			} else if (property) {
				list.push([item,lens]);
			}
		}
		var container = OAT.Dom.create("div",{},"fresnel_container");
		for (var i=0;i<list.length;i++) {
			var counter = [i,list.length]
			self.formatItem(container,list[i],property,counter,use);
		}
		if (parent) { 
			parent.appendChild(container); 
			return false;
		} else { 
			return container;	
		}
	}
	
	this.format = function(data) {
		self.depth = 1;
		self.stylesheets = [];
		return [self.formatContainer(false,data),self.stylesheets];
	}
}
OAT.Loader.featureLoaded("fresnel");
