import os
import glob
import re

def replace_in_files(old_str, new_str, directory):
    for filepath in glob.glob(f"{directory}/**/*.vue", recursive=True):
        with open(filepath, 'r') as file:
            content = file.read()
        if old_str in content:
            content = content.replace(old_str, new_str)
            with open(filepath, 'w') as file:
                file.write(content)

# Move AppModal
os.system("mv ui/app/components/ui/AppModal.vue ui/app/components/AppModal.vue")
replace_in_files("UiAppModal", "AppModal", "ui/app")
replace_in_files("ui/AppModal.vue", "AppModal.vue", "ui/app")

# Move AppButtonGroup
os.system("mv ui/app/components/ui/AppButtonGroup.vue ui/app/components/AppButtonGroup.vue")
replace_in_files("UiAppButtonGroup", "AppButtonGroup", "ui/app")

# Move AppTabs
os.system("mv ui/app/components/ui/AppTabs.vue ui/app/components/AppTabs.vue")
replace_in_files("UiAppTabs", "AppTabs", "ui/app")

# Rename and move UiConfirmModal -> AppConfirmModal
os.system("mv ui/app/components/ui/UiConfirmModal.vue ui/app/components/AppConfirmModal.vue")
replace_in_files("UiConfirmModal", "AppConfirmModal", "ui/app")
replace_in_files("ui/UiConfirmModal.vue", "AppConfirmModal.vue", "ui/app")

# Move specialized modals to modals/
os.system("mv ui/app/components/common/CreateFolderModal.vue ui/app/components/modals/CommonCreateFolderModal.vue")
replace_in_files("CommonCreateFolderModal", "ModalsCommonCreateFolderModal", "ui/app")
replace_in_files("CreateFolderModal", "ModalsCommonCreateFolderModal", "ui/app")

os.system("mv ui/app/components/common/RenameModal.vue ui/app/components/modals/CommonRenameModal.vue")
replace_in_files("CommonRenameModal", "ModalsCommonRenameModal", "ui/app")
replace_in_files("RenameModal", "ModalsCommonRenameModal", "ui/app")

os.system("mv ui/app/components/common/FileInfoModal.vue ui/app/components/modals/CommonFileInfoModal.vue")
replace_in_files("CommonFileInfoModal", "ModalsCommonFileInfoModal", "ui/app")
replace_in_files("FileInfoModal", "ModalsCommonFileInfoModal", "ui/app")

os.system("mv ui/app/components/ui/ArchiveDeleteModal.vue ui/app/components/modals/ArchiveDeleteModal.vue")
replace_in_files("UiArchiveDeleteModal", "ModalsArchiveDeleteModal", "ui/app")
replace_in_files("ArchiveDeleteModal", "ModalsArchiveDeleteModal", "ui/app")

