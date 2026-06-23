#import <WebKit/WebKit.h>
#import <objc/runtime.h>

// Removes the native iOS keyboard toolbar (the ^ v ✓ accessory bar) that
// WKWebView shows above the keyboard when a text input is focused. The app's
// CommandToolbar already supplies a Done button, so this native bar only
// wastes vertical screen space.
//
// iOS routes keyboard-toolbar requests through WKContentView (a private
// WKWebView subview). Returning nil from its inputAccessoryView getter is
// the standard published technique for suppressing it.
@interface WKWebView (SuppressKeyboardBar)
@end

@implementation WKWebView (SuppressKeyboardBar)

+ (void)load {
    // Dispatch to the main queue so Tauri has had a chance to boot and
    // WebKit's internal WKContentView class is registered in the runtime.
    dispatch_async(dispatch_get_main_queue(), ^{
        Class cls = NSClassFromString(@"WKContentView");
        if (!cls) return;

        SEL sel = @selector(inputAccessoryView);
        IMP imp = imp_implementationWithBlock(^UIView *(id _self) { return nil; });
        Method m = class_getInstanceMethod(cls, sel);
        if (m) {
            method_setImplementation(m, imp);
        } else {
            // "@16@0:8" encodes: returns id, arg0 = self (id), arg1 = SEL
            class_addMethod(cls, sel, imp, "@16@0:8");
        }
    });
}

@end
